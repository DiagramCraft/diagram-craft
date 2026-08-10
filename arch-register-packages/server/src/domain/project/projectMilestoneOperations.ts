import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { canAccessProject, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import {
  buildCreateMilestoneInput,
  buildUpdateMilestoneInput,
  toApiMilestone
} from './projectMilestoneHelpers';
import {
  Milestone,
  CreateMilestoneRequest,
  UpdateMilestoneRequest
} from '@arch-register/api-types/milestoneContract';

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const dbErrorMessages = {
  unique: 'A milestone with that name already exists in this project'
};

export const listMilestones = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string | undefined,
  event: AuthenticatedEvent
): Promise<Milestone[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve milestones',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const [rows, projects] = await Promise.all([
        db.project.listMilestones(ws),
        db.project.listProjects(ws)
      ]);
      const visibleProjects = new Map(
        projects
          .filter(project => canAccessProject(authCtx, project.owner))
          .map(project => [project.id, project])
      );
      const requestedProjectIds = new Set(
        projects
          .filter(project => project.id === projectId || project.public_id === projectId)
          .map(project => project.id)
      );
      return rows
        .filter(row => projectId == null || requestedProjectIds.has(row.project_id))
        .filter(row => visibleProjects.has(row.project_id))
        .map(toApiMilestone);
    }
  });
};

export const getMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve milestone',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const row = await db.project.getMilestoneById(ws, id);
      httpAssert.present(row, { status: 404, message: `Milestone '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, row.project_id);
      if (!canAccessProject(authCtx, project.owner)) {
        httpAssert.true(false, { status: 404, message: `Milestone '${id}' not found` });
      }
      return toApiMilestone(row);
    }
  });
};

export const createMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateMilestoneRequest,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create milestone',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, body.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to create milestones in this project'
      );

      const timestamp = new Date();
      const row = await db.project.createMilestone(
        buildCreateMilestoneInput(ws, project.id, body, timestamp)
      );

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'project_milestone',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      return toApiMilestone(row);
    }
  });
};

export const updateMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateMilestoneRequest,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update milestone',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const oldRow = await db.project.getMilestoneById(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Milestone '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, oldRow.project_id);
      httpAssert.true(body.project_id === oldRow.project_id, {
        status: 400,
        message: 'A milestone cannot be moved to another project'
      });
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to edit milestones in this project'
      );

      const row = await db.project.updateMilestone(
        ws,
        project.id,
        id,
        buildUpdateMilestoneInput(body, oldRow, new Date())
      );
      httpAssert.present(row, { status: 404, message: `Milestone '${id}' not found` });
      if (row.target_date !== oldRow.target_date) {
        await db.catalog.updateChangeCaseEffectiveDateForMilestone(ws, row.id, row.target_date);
      }

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'project_milestone',
        entityId: row.id,
        entityName: row.name,
        changes
      });

      return toApiMilestone(row);
    }
  });
};

export const deleteMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete milestone',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const row = await db.project.getMilestoneById(ws, id);
      httpAssert.present(row, { status: 404, message: `Milestone '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, row.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to delete milestones in this project'
      );

      // Backfill any linked planned change cases before removing the milestone, so the
      // planned date isn't lost, only the named grouping (ON DELETE SET NULL is a backstop).
      await db.catalog.reassignSnapshotsFromMilestone(ws, id, row.target_date);
      await db.project.deleteMilestone(ws, row.project_id, id);

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'project_milestone',
        entityId: row.id,
        entityName: row.name,
        changes: { old: extractEntityFields(row) }
      });

      return { success: true, message: `Milestone '${id}' deleted` };
    }
  });
};
