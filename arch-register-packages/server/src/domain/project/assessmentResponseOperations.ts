import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { handleDbError } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toApiAssessmentResponse } from './assessmentResponseHelpers';
import { AssessmentResponse, UpsertAssessmentResponseRequest } from '@arch-register/api-types/assessmentResponseContract';

const handleError = (error: unknown, fallback: string): never => handleDbError(error, fallback);

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const getAssessmentOrThrow = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  assessmentId: string
) => {
  const assessment = await db.project.getAssessment(ws, projectId, assessmentId);
  httpAssert.present(assessment, { status: 404, message: `Assessment '${assessmentId}' not found` });
  return assessment;
};

export const listAssessmentResponses = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  assessmentId: string,
  event: AuthenticatedEvent
): Promise<AssessmentResponse[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await getProjectOrThrow(db, ws, projectId);
    requireProjectAccess(authCtx, project.owner);

    const assessment = await getAssessmentOrThrow(db, ws, project.id, assessmentId);
    const rows = await db.project.listAssessmentResponses(ws, assessmentId);
    return rows.map(row => toApiAssessmentResponse(row, assessment));
  } catch (error) {
    return handleError(error, 'Failed to retrieve assessment responses');
  }
};

export const upsertAssessmentResponse = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  assessmentId: string,
  entityId: string,
  body: UpsertAssessmentResponseRequest,
  event: AuthenticatedEvent
): Promise<AssessmentResponse> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await getProjectOrThrow(db, ws, projectId);
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to record assessment responses in this project'
    );

    const assessment = await getAssessmentOrThrow(db, ws, project.id, assessmentId);
    const existing = await db.project.getAssessmentResponse(ws, assessmentId, entityId);
    const existingValues = existing?.values ?? {};

    const values: Record<string, string | number> = { ...existingValues };
    for (const [fieldId, value] of Object.entries(body.values)) {
      if (value === null) delete values[fieldId];
      else values[fieldId] = value;
    }

    const row = await db.project.upsertAssessmentResponse({
      workspace: ws,
      assessment_id: assessmentId,
      entity_id: entityId,
      values,
      updated_by: authCtx.userId
    });

    await logAudit(db, {
      userId: authCtx.userId,
      workspace: ws,
      operation: existing ? 'update' : 'create',
      entityType: 'assessment_response',
      entityId: row.id,
      entityName: `${assessment.name} / ${entityId}`,
      changes: existing
        ? computeChanges(extractEntityFields(existing), extractEntityFields(row))
        : { new: extractEntityFields(row) }
    });

    return toApiAssessmentResponse(row, assessment);
  } catch (error) {
    return handleError(error, 'Failed to record assessment response');
  }
};
