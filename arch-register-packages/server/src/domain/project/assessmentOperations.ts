import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildCreateAssessmentInput, buildUpdateAssessmentInput, toApiAssessment } from './assessmentHelpers';
import { countCompletedEntities } from './assessmentResponseHelpers';
import type { AssessmentDbResult } from './db/projectDatabase';
import {
  Assessment,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  UpdateAssessmentStatusRequest
} from '@arch-register/api-types/assessmentContract';

const getAssessmentStats = async (db: DatabaseAdapter, ws: string, row: AssessmentDbResult) => {
  const responses = await db.project.listAssessmentResponses(ws, row.id);
  return {
    response_count: responses.length,
    completed_entity_count: countCompletedEntities(responses, row)
  };
};

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    unique: 'An assessment with that name already exists in this project'
  });

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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await getProjectOrThrow(db, ws, projectId);
    requireProjectAccess(authCtx, project.owner);

    const rows = await db.project.listAssessments(ws, project.id);
    return await Promise.all(rows.map(async row => toApiAssessment(row, await getAssessmentStats(db, ws, row))));
  } catch (error) {
    return handleError(error, 'Failed to retrieve assessments');
  }
};

export const getAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await getProjectOrThrow(db, ws, projectId);
    requireProjectAccess(authCtx, project.owner);

    const row = await db.project.getAssessment(ws, project.id, id);
    httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });
    return toApiAssessment(row, await getAssessmentStats(db, ws, row));
  } catch (error) {
    return handleError(error, 'Failed to retrieve assessment');
  }
};

export const createAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  body: CreateAssessmentRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
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
  } catch (error) {
    return handleError(error, 'Failed to create assessment');
  }
};

export const updateAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  body: UpdateAssessmentRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
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
  } catch (error) {
    return handleError(error, 'Failed to update assessment');
  }
};

export const updateAssessmentStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  body: UpdateAssessmentStatusRequest,
  event: AuthenticatedEvent
): Promise<Assessment> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await getProjectOrThrow(db, ws, projectId);
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to archive assessments in this project'
    );

    const oldRow = await db.project.getAssessment(ws, project.id, id);
    httpAssert.present(oldRow, { status: 404, message: `Assessment '${id}' not found` });

    const row = await db.project.updateAssessment(ws, project.id, id, {
      name: oldRow.name,
      description: oldRow.description,
      status: body.status,
      scope: oldRow.scope,
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
  } catch (error) {
    return handleError(error, 'Failed to update assessment status');
  }
};

export const deleteAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
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
  } catch (error) {
    return handleError(error, 'Failed to delete assessment');
  }
};
