import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  canAccessProject,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { httpAssert } from '../../utils/httpAssert';
import { defineOperation } from '../operation';
import {
  buildCreateAssessmentInput,
  buildUpdateAssessmentInput,
  toApiAssessment,
  type AssessmentTeamAcknowledgeStatus
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
import {
  scheduleNextAssessmentOccurrence,
  cancelPendingAssessmentOccurrence
} from './assessmentRecurrenceJob';
import {
  ASSESSMENT_RESPONSE_CASE_KIND,
  createAssessmentGovernanceRegistry,
  openAssessmentGovernanceCase,
  closeAssessmentGovernanceCase
} from './assessmentGovernance';
import { materializeDerivedFields } from '../derived/derivedFields';
import {
  assessmentScopeHasRestrictedConditions,
  assertAssessmentScopeConditionsAuthorized,
  mergeVisibleAssessmentScopeConditions
} from './assessmentScopeAccess';

export {
  ASSESSMENT_RESPONSE_CASE_KIND,
  createAssessmentGovernanceRegistry,
  openAssessmentGovernanceCase,
  closeAssessmentGovernanceCase
};

const getTeamAcknowledgeStatus = async (
  db: DatabaseAdapter,
  ws: string,
  row: AssessmentDbResult
): Promise<AssessmentTeamAcknowledgeStatus[]> => {
  if (row.assigned_team_ids.length === 0) return [];

  const [cases, teams] = await Promise.all([
    db.governance.listCases(ws, {
      caseKind: ASSESSMENT_RESPONSE_CASE_KIND,
      subjectType: 'assessment',
      subjectId: row.id
    }),
    db.workspace.listTeams(ws)
  ]);
  if (cases.length === 0) return [];

  const latestCase = cases.reduce((latest, current) =>
    current.created_at > latest.created_at ? current : latest
  );
  const assignments = await db.governance.listAssignmentsForCase(latestCase.id);
  const teamNames = new Map(teams.map(team => [team.id, team.name]));

  return assignments
    .filter(assignment => assignment.target_type === 'team' && assignment.target_team_id != null)
    .map(assignment => ({
      team_id: assignment.target_team_id!,
      team_name: teamNames.get(assignment.target_team_id!) ?? assignment.target_team_id!,
      status: assignment.status,
      resolved_at: assignment.resolved_at ? assignment.resolved_at.toISOString() : null
    }));
};

const getAssessmentStats = async (
  db: DatabaseAdapter,
  ws: string,
  row: AssessmentDbResult,
  authCtx: Parameters<typeof assessmentScopeHasRestrictedConditions>[2],
  schemas: Awaited<ReturnType<DatabaseAdapter['catalog']['listSchemas']>>,
  entities?: EntityDbResult[]
) => {
  const [responses, scopedEntities, team_acknowledge_status] = await Promise.all([
    db.project.listAssessmentResponses(ws, row.id, row.current_occurrence),
    entities ? Promise.resolve(entities) : listAllCatalogEntities(db, ws),
    getTeamAcknowledgeStatus(db, ws, row)
  ]);
  const scopedEntityIds = new Set(
    scopedEntities
      .filter(entity => isEntityInAssessmentScope(entity, row, { authCtx, schemas }))
      .map(entity => entity.id)
  );
  const scopedResponses = responses.filter(response => scopedEntityIds.has(response.entity_id));
  const hasRestrictedConditions = assessmentScopeHasRestrictedConditions(row, schemas, authCtx);
  return {
    response_count: hasRestrictedConditions ? 0 : responses.length,
    completed_entity_count: countCompletedEntities(scopedResponses, row),
    team_acknowledge_status
  };
};

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const assertAssessmentType = async (
  db: DatabaseAdapter,
  workspace: string,
  typeId: string | null | undefined,
  allowInactive: boolean
) => {
  if (!typeId) return;
  const type = (await db.workspace.listAssessmentTypes(workspace)).find(item => item.id === typeId);
  httpAssert.true(type != null, {
    status: 400,
    message: `Assessment type '${typeId}' does not exist in this workspace`
  });
  if (!allowInactive) {
    httpAssert.true(type!.is_active, {
      status: 400,
      message: `Assessment type '${typeId}' is inactive`
    });
  }
};

export const listAssessments = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const [rows, projects, entities, schemas] = await Promise.all([
        db.project.listAssessments(ws),
        db.project.listProjects(ws),
        listAllCatalogEntities(db, ws),
        db.catalog.listSchemas(ws)
      ]);
      const visibleProjects = new Map(
        projects
          .filter(project => canAccessProject(authCtx, project.owner))
          .map(project => [project.id, project])
      );
      return await Promise.all(
        rows
          .filter(row => visibleProjects.has(row.project_id))
          .map(async row =>
            toApiAssessment(
              row,
              await getAssessmentStats(db, ws, row, authCtx, schemas, entities),
              row.project_id,
              authCtx,
              schemas
            )
          )
      );
    }
  );
};

export const getAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const row = await db.project.getAssessmentById(ws, id);
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, row.project_id);
      requireProjectAccess(authCtx, project.owner);
      const schemas = await db.catalog.listSchemas(ws);
      return toApiAssessment(
        row,
        await getAssessmentStats(db, ws, row, authCtx, schemas),
        project.id,
        authCtx,
        schemas
      );
    }
  );
};

export const createAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const project = await getProjectOrThrow(db, ws, body.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to create assessments in this project'
      );

      const schemas = await db.catalog.listSchemas(ws);
      const scope = Array.isArray(body.scope) ? body.scope : [];
      const scopeConditions = Array.isArray(body.scope_conditions) ? body.scope_conditions : [];
      assertAssessmentScopeConditionsAuthorized(scope, scopeConditions, schemas, authCtx);
      await assertAssessmentType(db, ws, body.assessment_type_id, false);

      const timestamp = new Date();
      const row = await db.project.createAssessment(
        buildCreateAssessmentInput(ws, { ...body, project_id: project.id }, timestamp)
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

      return toApiAssessment(
        row,
        { response_count: 0, completed_entity_count: 0 },
        project.id,
        authCtx,
        schemas
      );
    }
  );
};

export const updateAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const existing = await db.project.getAssessmentById(ws, id);
      httpAssert.present(existing, { status: 404, message: `Assessment '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, existing.project_id);
      const requestedProject = await getProjectOrThrow(db, ws, body.project_id);
      httpAssert.true(requestedProject.id === project.id, {
        status: 400,
        message: 'Assessment project ownership cannot be changed'
      });
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to edit assessments in this project'
      );

      const schemas = await db.catalog.listSchemas(ws);
      const requestedScope = Array.isArray(body.scope) ? body.scope : existing.scope;
      if (Array.isArray(body.scope_conditions)) {
        assertAssessmentScopeConditionsAuthorized(
          requestedScope,
          body.scope_conditions,
          schemas,
          authCtx
        );
      }
      await assertAssessmentType(
        db,
        ws,
        body.assessment_type_id,
        body.assessment_type_id === existing.assessment_type_id
      );
      const scopeConditions = Array.isArray(body.scope_conditions)
        ? mergeVisibleAssessmentScopeConditions(existing, body.scope_conditions, schemas, authCtx)
        : undefined;

      const row = await db.core.transaction(async tx => {
        const updated = await tx.project.updateAssessment(
          ws,
          project.id,
          id,
          buildUpdateAssessmentInput(
            scopeConditions === undefined ? body : { ...body, scope_conditions: scopeConditions },
            existing,
            new Date()
          )
        );
        if (updated) {
          const responses = await tx.project.listAllAssessmentResponses(ws, id);
          const previousDerivedIds = new Set(
            existing.fields.filter(field => field.type === 'derived').map(field => field.id)
          );
          for (const response of responses) {
            const responseValues = { ...response.values };
            previousDerivedIds.forEach(fieldId => delete responseValues[fieldId]);
            await tx.project.updateAssessmentResponseDerivedFields(
              ws,
              id,
              response.entity_id,
              response.occurrence,
              materializeDerivedFields(updated.fields, responseValues, {
                objectType: 'assessment',
                objectId: response.id
              }) as Record<string, string | number | boolean>
            );
          }
        }
        return updated;
      });
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });

      const changes = computeChanges(extractEntityFields(existing), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'assessment',
        entityId: row.id,
        entityName: row.name,
        changes
      });

      return toApiAssessment(
        row,
        await getAssessmentStats(db, ws, row, authCtx, schemas),
        project.id,
        authCtx,
        schemas
      );
    }
  );
};

export const updateAssessmentStatus = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const oldRow = await db.project.getAssessmentById(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Assessment '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, oldRow.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to change assessment status in this project'
      );

      const schemas = await db.catalog.listSchemas(ws);

      const row = await db.core.transaction(async tx => {
        const now = new Date();
        let updated = await tx.project.updateAssessment(ws, project.id, id, {
          name: oldRow.name,
          description: oldRow.description,
          status: body.status,
          mode: oldRow.mode,
          scope: oldRow.scope,
          scope_conditions: oldRow.scope_conditions,
          fields: oldRow.fields,
          groups: oldRow.groups,
          assigned_team_ids: oldRow.assigned_team_ids,
          due_at: oldRow.due_at,
          recurrence: oldRow.recurrence,
          response_window_days: oldRow.response_window_days,
          current_occurrence: oldRow.current_occurrence,
          pending_occurrence_job_run_id: oldRow.pending_occurrence_job_run_id,
          next_occurrence_at: oldRow.next_occurrence_at,
          updated_at: now
        });
        if (updated) {
          if (oldRow.status !== 'open' && body.status === 'open') {
            await openAssessmentGovernanceCase(tx, ws, authCtx.userId, updated);
            updated = await scheduleNextAssessmentOccurrence(tx, ws, updated, now);
          } else if (oldRow.status === 'open' && body.status !== 'open') {
            await closeAssessmentGovernanceCase(tx, ws, updated.id);
            updated = await cancelPendingAssessmentOccurrence(tx, ws, updated, now);
          }
        }
        return updated;
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

      return toApiAssessment(
        row,
        await getAssessmentStats(db, ws, row, authCtx, schemas),
        project.id,
        authCtx,
        schemas
      );
    }
  );
};

export const deleteAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
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
      const row = await db.project.getAssessmentById(ws, id);
      httpAssert.present(row, { status: 404, message: `Assessment '${id}' not found` });
      const project = await getProjectOrThrow(db, ws, row.project_id);
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to delete assessments in this project'
      );

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
