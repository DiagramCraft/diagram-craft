import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { httpAssert } from '../../utils/httpAssert';
import { defineOperation } from '../operation';
import {
  buildCreateAssessmentInput,
  buildUpdateAssessmentInput,
  toApiAssessment
} from './assessmentHelpers';
import { countCompletedEntities, isEntityInAssessmentScope } from './assessmentResponseHelpers';
import type { AssessmentDbResult } from './db/projectDatabase';
import type { EntityDbResult } from '../catalog/db/catalogDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import {
  Assessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  UpdateAssessmentStatusRequest
} from '@arch-register/api-types/assessmentContract';

const getAssessmentStats = async (
  db: DatabaseAdapter,
  ws: string,
  row: AssessmentDbResult,
  entities?: EntityDbResult[]
) => {
  const [responses, scopedEntities] = await Promise.all([
    db.project.listAssessmentResponses(ws, row.id),
    entities ? Promise.resolve(entities) : listAllCatalogEntities(db, ws)
  ]);
  const scopedEntityIds = new Set(
    scopedEntities.filter(entity => isEntityInAssessmentScope(entity, row)).map(entity => entity.id)
  );
  const scopedResponses = responses.filter(response => scopedEntityIds.has(response.entity_id));
  return {
    response_count: responses.length,
    completed_entity_count: countCompletedEntities(scopedResponses, row)
  };
};

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

export const listAssessments = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<Assessment[]> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve assessments',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const [rows, entities] = await Promise.all([
        db.project.listAssessments(ws, project.id),
        listAllCatalogEntities(db, ws)
      ]);
      return await Promise.all(
        rows.map(async row => toApiAssessment(row, await getAssessmentStats(db, ws, row, entities)))
      );
    }
  );
};

export const getAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to retrieve assessment',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const row = await db.project.getAssessment(ws, project.id, id);
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });
      return toApiAssessment(row, await getAssessmentStats(db, ws, row));
    }
  );
};

export const createAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  body: CreateAssessmentRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to create assessment',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to create assessments in this project'
      );

      const timestamp = new Date();
      const row = await db.project.createAssessment(
        buildCreateAssessmentInput(ws, project.id, body, timestamp)
      );

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'assessment',
        entityId: row.id,
        entityName: row.name,
        changes: { new: extractEntityFields(row) }
      });

      return toApiAssessment(row, { response_count: 0, completed_entity_count: 0 });
    }
  );
};

export const updateAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  body: UpdateAssessmentRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update assessment',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to edit assessments in this project'
      );

      const oldRow = await db.project.getAssessment(ws, project.id, id);
      httpAssert.present(oldRow, { status: 404, message: `Assessment '${id}' not found` });

      const row = await db.project.updateAssessment(
        ws,
        project.id,
        id,
        buildUpdateAssessmentInput(body, oldRow, new Date())
      );
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'assessment',
        entityId: row.id,
        entityName: row.name,
        changes
      });

      return toApiAssessment(row, await getAssessmentStats(db, ws, row));
    }
  );
};

export const updateAssessmentStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  body: UpdateAssessmentStatusRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to update assessment status',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to change assessment status in this project'
      );

      const oldRow = await db.project.getAssessment(ws, project.id, id);
      httpAssert.present(oldRow, { status: 404, message: `Assessment '${id}' not found` });

      const row = await db.project.updateAssessment(ws, project.id, id, {
        name: oldRow.name,
        description: oldRow.description,
        status: body.status,
        scope: oldRow.scope,
        scope_conditions: oldRow.scope_conditions,
        fields: oldRow.fields,
        updated_at: new Date()
      });
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'assessment',
        entityId: row.id,
        entityName: row.name,
        changes: computeChanges(extractEntityFields(oldRow), extractEntityFields(row))
      });

      return toApiAssessment(row, await getAssessmentStats(db, ws, row));
    }
  );
};

export const deleteAssessment = async (
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
    {
      fallback: 'Failed to delete assessment',
      dbErrorMessages: {
        unique: 'An assessment with that name already exists in this project'
      }
    },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to delete assessments in this project'
      );

      const row = await db.project.getAssessment(ws, project.id, id);
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });

      await db.project.deleteAssessment(ws, project.id, id);

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'assessment',
        entityId: row.id,
        entityName: row.name,
        changes: { old: extractEntityFields(row) }
      });

      return { success: true, message: `Assessment '${id}' deleted` };
    }
  );
};
