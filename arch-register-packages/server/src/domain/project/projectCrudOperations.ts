import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import { HTTPError } from 'h3';
import {
  canAccessProject,
  requireCanCreateProject,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { projectDbErrorMessages } from './projectOperationHelpers';
import { httpAssert } from '../../utils/httpAssert';
import { buildFileTree } from './contentTreeOperations';
import { toApiProject, toApiProjectDetail } from './projectHelpers';
import { formatPublicId } from '../../utils/publicIds';
import type { Project, ProjectDetail } from '@arch-register/api-types/projectContract';

const PROJECT_STATUSES = ['draft', 'active', 'complete', 'cancelled'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const parseProjectStatus = (value: unknown): ProjectStatus => {
  if (value == null || value === '') return 'active';
  if (typeof value !== 'string' || !PROJECT_STATUSES.includes(value as ProjectStatus)) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`
    });
  }
  return value as ProjectStatus;
};

const resolveProjectOwner = (owner: unknown, teamIds: Set<string>) =>
  typeof owner === 'string' && teamIds.has(owner) ? owner : null;

export const listProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<Project[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve projects',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const projects = await db.project.listProjects(ws);
      const visibleProjects = projects.filter(project => canAccessProject(authCtx, project.owner));
      const fileCounts = new Map<string, number>();
      const projectFiles = await Promise.all(
        visibleProjects.map(project => db.project.listContentNodes(ws, project.id))
      );
      for (const files of projectFiles) {
        for (const file of files) {
          if (file.type === 'diagram' && file.project_id != null) {
            fileCounts.set(file.project_id, (fileCounts.get(file.project_id) ?? 0) + 1);
          }
        }
      }
      return visibleProjects
        .map(project => toApiProject(project, fileCounts.get(project.id) ?? 0, authCtx))
        .sort((a, b) => {
          const pinnedRank = (a.pinned ? 0 : 1) - (b.pinned ? 0 : 1);
          if (pinnedRank !== 0) return pinnedRank;
          const rank = { draft: 0, active: 1, complete: 2, cancelled: 3 } as const;
          return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
        });
    }
  );
};

export const getProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<ProjectDetail> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, id);
      httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
      requireProjectAccess(authCtx, project.owner);
      const files = await db.project.listContentNodes(ws, project.id);
      return toApiProjectDetail(project, buildFileTree(files), authCtx);
    }
  );
};

export const createProject = async (
  db: DatabaseAdapter,
  workspace: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'draft' | 'active' | 'complete' | 'cancelled';
    color?: string | null;
    target_date?: string | null;
    pinned?: boolean;
  },
  event: AuthenticatedEvent
): Promise<Project> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const teamIds = new Set((await db.workspace.listTeams(ws)).map(row => row.id));
      const timestamp = new Date();
      const workspaceRow = await db.workspace.getWorkspace(ws);
      httpAssert.present(workspaceRow, { status: 404, message: `Workspace '${ws}' not found` });

      httpAssert.present(input.name, { message: 'name is required' });

      const publicId = formatPublicId(
        workspaceRow.short_code,
        await db.workspace.allocatePublicId(workspaceRow.short_code, timestamp)
      );

      const createInput = {
        id: randomUUID(),
        workspace: ws,
        public_id: publicId,
        name: input.name,
        description: input.description ?? '',
        owner: resolveProjectOwner(input.owner, teamIds),
        status: parseProjectStatus(input.status),
        color: typeof input.color === 'string' ? input.color : null,
        target_date: typeof input.target_date === 'string' ? input.target_date : null,
        pinned: input.pinned ?? false,
        created_at: timestamp,
        updated_at: timestamp
      };

      requireCanCreateProject(
        authCtx,
        createInput.owner,
        'You do not have permission to create a project for this owner team'
      );

      const row = await db.project.createProject(createInput);

      await logAudit(db, {
        userId: authCtx?.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'project',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      return toApiProject(row, 0, authCtx);
    }
  );
};

export const updateProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'draft' | 'active' | 'complete' | 'cancelled';
    color?: string | null;
    target_date?: string | null;
    pinned?: boolean;
  },
  event: AuthenticatedEvent
): Promise<Project> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const oldRow = await db.project.getProject(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Project '${id}' not found` });
      const teamIds = new Set((await db.workspace.listTeams(ws)).map(row => row.id));

      httpAssert.present(input.name, { message: 'name is required' });
      const projectStatus =
        input.status === undefined ? undefined : parseProjectStatus(input.status);
      const newOwner =
        input.owner !== undefined ? resolveProjectOwner(input.owner, teamIds) : oldRow.owner;

      const updateInput = {
        name: input.name,
        description:
          input.description !== undefined
            ? typeof input.description === 'string'
              ? input.description
              : ''
            : oldRow.description,
        owner: newOwner,
        status: projectStatus ?? oldRow.status,
        color:
          input.color !== undefined
            ? typeof input.color === 'string'
              ? input.color
              : null
            : oldRow.color,
        target_date:
          input.target_date !== undefined
            ? typeof input.target_date === 'string'
              ? input.target_date
              : null
            : oldRow.target_date,
        pinned: input.pinned !== undefined ? input.pinned : oldRow.pinned,
        updated_at: new Date()
      };

      requireProjectAction(
        authCtx,
        oldRow.owner,
        'edit_project',
        'You do not have permission to edit this project'
      );
      if (newOwner !== oldRow.owner) {
        requireProjectAction(
          authCtx,
          newOwner,
          'edit_project',
          'You do not have permission to transfer this project to the target owner team'
        );
      }

      const row = await db.project.updateProject(ws, oldRow.id, updateInput);
      httpAssert.present(row, { status: 404, message: `Project '${id}' not found` });

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'project',
        entityId: oldRow.id,
        entityName: row.name,
        changes
      });

      const fileCount = (await db.project.listContentNodes(ws, oldRow.id)).length;
      return toApiProject(row, fileCount, authCtx);
    }
  );
};

export const deleteProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<{ success: boolean; message: string }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to delete project',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, id);
      httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });

      requireProjectAction(
        authCtx,
        project.owner,
        'delete_project',
        'You do not have permission to delete this project'
      );

      await db.project.deleteProject(ws, project.id);

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'project',
        entityId: project.id,
        entityName: project.name,
        changes: { old: extractEntityFields(project) }
      });

      if (storage) {
        await storage.deleteAll(ws, project.id).catch(() => {});
      }

      return { success: true, message: `Project '${project.id}' deleted` };
    }
  );
};
