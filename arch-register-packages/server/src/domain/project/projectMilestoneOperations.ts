import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { httpAssert } from '../../utils/httpAssert';
import { defineOperation } from '../operation';
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
  projectId: string,
  event: AuthenticatedEvent
): Promise<Milestone[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve milestones', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const rows = await db.project.listMilestones(ws, project.id);
      return rows.map(toApiMilestone);
    }
  );
};

export const getMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve milestone', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const row = await db.project.getMilestone(ws, project.id, id);
      httpAssert.present(row, { status: 404, message: `Milestone '${id}' not found` });
      return toApiMilestone(row);
    }
  );
};

export const createMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  body: CreateMilestoneRequest,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create milestone', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
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
  );
};

export const updateMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  body: UpdateMilestoneRequest,
  event: AuthenticatedEvent
): Promise<Milestone> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update milestone', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to edit milestones in this project'
      );

      const oldRow = await db.project.getMilestone(ws, project.id, id);
      httpAssert.present(oldRow, { status: 404, message: `Milestone '${id}' not found` });

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
  );
};

export const deleteMilestone = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete milestone', dbErrorMessages },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to delete milestones in this project'
      );

      const row = await db.project.getMilestone(ws, project.id, id);
      httpAssert.present(row, { status: 404, message: `Milestone '${id}' not found` });

      // Backfill any linked planned change cases before removing the milestone, so the
      // planned date isn't lost, only the named grouping (ON DELETE SET NULL is a backstop).
      await db.catalog.reassignSnapshotsFromMilestone(ws, id, row.target_date);
      await db.project.deleteMilestone(ws, project.id, id);

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
  );
};
