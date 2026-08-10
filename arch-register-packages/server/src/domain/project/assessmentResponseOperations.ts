import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireProjectAccess, requireProjectAction } from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import {
  toApiAssessmentResponse,
  buildAssessmentResultsCsvData
} from './assessmentResponseHelpers';
import {
  AssessmentResponse,
  UpsertAssessmentResponseRequest
} from '@arch-register/api-types/assessmentResponseContract';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { generateCsv } from '../../utils/csv';
import { assertNoDerivedFieldWrites, materializeDerivedFields } from '../derived/derivedFields';
import { assessmentScopeHasRestrictedConditions } from './assessmentScopeAccess';

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const getAssessmentOrThrow = async (db: DatabaseAdapter, ws: string, assessmentId: string) => {
  const assessment = await db.project.getAssessmentById(ws, assessmentId);
  httpAssert.present(assessment, {
    status: 404,
    message: `Assessment '${assessmentId}' not found`
  });
  return assessment;
};

export const listAssessmentResponses = async (
  db: DatabaseAdapter,
  workspace: string,
  assessmentId: string,
  event: AuthenticatedEvent
): Promise<AssessmentResponse[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve assessment responses',
    operation: async ({ ws, authCtx }) => {
      const assessment = await getAssessmentOrThrow(db, ws, assessmentId);
      const project = await getProjectOrThrow(db, ws, assessment.project_id);
      requireProjectAccess(authCtx, project.owner);
      const schemas = await db.catalog.listSchemas(ws);
      if (assessmentScopeHasRestrictedConditions(assessment, schemas, authCtx)) return [];
      const rows = await db.project.listAssessmentResponses(
        ws,
        assessmentId,
        assessment.current_occurrence
      );
      return rows.map(row => toApiAssessmentResponse(row, assessment));
    }
  });
};

export const upsertAssessmentResponse = async (
  db: DatabaseAdapter,
  workspace: string,
  assessmentId: string,
  entityId: string,
  body: UpsertAssessmentResponseRequest,
  event: AuthenticatedEvent
): Promise<AssessmentResponse> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to record assessment response',
    operation: async ({ ws, authCtx }) => {
      const assessment = await getAssessmentOrThrow(db, ws, assessmentId);
      const project = await getProjectOrThrow(db, ws, assessment.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to record assessment responses in this project'
      );

      httpAssert.true(assessment.status === 'open', {
        status: 409,
        message: 'Cannot record responses: assessment is not open'
      });
      httpAssert.true(assessment.mode !== 'confirm' || Object.keys(body.values).length === 0, {
        status: 400,
        message: 'Confirm-only assessments do not accept field values'
      });
      try {
        assertNoDerivedFieldWrites(assessment.fields, body.values);
      } catch (error) {
        httpAssert.true(false, {
          status: 400,
          message: error instanceof Error ? error.message : String(error)
        });
      }
      const existing = await db.project.getAssessmentResponse(
        ws,
        assessmentId,
        entityId,
        assessment.current_occurrence
      );
      const existingValues = existing?.values ?? {};

      const values: Record<string, string | number | boolean> = { ...existingValues };
      for (const [fieldId, value] of Object.entries(body.values)) {
        if (value === null) delete values[fieldId];
        else values[fieldId] = value;
      }

      const materializedValues = materializeDerivedFields(assessment.fields, values, {
        objectType: 'assessment',
        objectId: entityId
      }) as Record<string, string | number | boolean>;

      const row = await db.project.upsertAssessmentResponse({
        workspace: ws,
        assessment_id: assessmentId,
        entity_id: entityId,
        occurrence: assessment.current_occurrence,
        values: materializedValues,
        updated_by: authCtx.userId
      });

      if (assessment.mode === 'confirm') {
        await db.catalog.touchEntityAttestation(ws, entityId, new Date());
      }

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: existing ? 'update' : 'create',
        entityType: 'assessment_response',
        entityId: row.id,
        entityName: `${assessment.name} / ${entityId}`,
        metadata: { subject_entity_id: entityId },
        changes: existing
          ? computeChanges(extractEntityFields(existing), extractEntityFields(row))
          : { new: extractEntityFields(row) }
      });

      return toApiAssessmentResponse(row, assessment);
    }
  });
};

export const exportAssessmentResponsesCsv = async (
  db: DatabaseAdapter,
  workspace: string,
  assessmentId: string,
  event: AuthenticatedEvent
): Promise<{ headers: Record<string, string>; body: Blob }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to export assessment results',
    operation: async ({ ws, authCtx }) => {
      const assessment = await getAssessmentOrThrow(db, ws, assessmentId);
      const project = await getProjectOrThrow(db, ws, assessment.project_id);
      requireProjectAccess(authCtx, project.owner);
      const [allEntities, responses, enums, schemas] = await Promise.all([
        listAllCatalogEntities(db, ws),
        db.project.listAssessmentResponses(ws, assessmentId, assessment.current_occurrence),
        db.catalog.listEnums(ws),
        db.catalog.listSchemas(ws)
      ]);

      const { columns, rows } = buildAssessmentResultsCsvData(
        allEntities,
        responses,
        assessment,
        enums,
        { authCtx, schemas }
      );
      const csvContent = generateCsv(rows, columns, ';');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${assessment.name.toLowerCase().replace(/\s+/g, '-')}-results-${timestamp}.csv`;

      return {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`
        },
        body: new Blob([csvContent], { type: 'text/csv; charset=utf-8' })
      };
    }
  });
};
