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
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import type { GovernanceRegistry } from '../governance/governanceRegistry';

export const ASSESSMENT_RESPONSE_CASE_KIND = 'assessment.response';

export const createAssessmentGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      ASSESSMENT_RESPONSE_CASE_KIND,
      {
        subjectVisible: async (
          db: DatabaseAdapter,
          _authCtx,
          workspace: string,
          subjectId: string
        ) => {
          const assessment = await db.project.getAssessmentById(workspace, subjectId);
          return assessment != null;
        },
        independentAssignmentActions: new Set(['acknowledge' as const])
      }
    ]
  ]);

const openAssessmentGovernanceCase = async (
  tx: DatabaseAdapter,
  workspace: string,
  initiatorUserId: string,
  row: AssessmentDbResult
): Promise<void> => {
  if (row.assigned_team_ids.length === 0) return;
  await createGovernanceCaseInTransaction(tx, workspace, initiatorUserId, {
    caseKind: ASSESSMENT_RESPONSE_CASE_KIND,
    subjectType: 'assessment',
    subjectId: row.id,
    selfApprovalAllowed: true,
    dueAt: row.due_at,
    payload: { projectId: row.project_id, name: row.name },
    assignments: row.assigned_team_ids.map(teamId => ({
      action: 'acknowledge' as const,
      target: { type: 'team' as const, teamId }
    }))
  });
};

const closeAssessmentGovernanceCase = async (
  tx: DatabaseAdapter,
  workspace: string,
  assessmentId: string
): Promise<void> => {
  const openCases = await tx.governance.listCases(workspace, {
    caseKind: ASSESSMENT_RESPONSE_CASE_KIND,
    subjectId: assessmentId,
    status: 'open'
  });
  const now = new Date();
  for (const caseRow of openCases) {
    const completed = await tx.governance.completeCaseIfOpen(caseRow.id, 'closed', now);
    if (!completed) continue;
    const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
    await resolveAssignmentNotifications(tx, supersededIds, now);
    await resolveCaseNotifications(tx, completed.id, now);
    await recordGovernanceEvent(tx, completed, {
      eventType: 'cancelled',
      actorUserId: null,
      previousStatus: 'open',
      resultingStatus: 'completed',
      reason: 'Assessment closed',
      metadata: {}
    });
  }
};

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
      const [rows, projects, entities] = await Promise.all([
        db.project.listAssessments(ws),
        db.project.listProjects(ws),
        listAllCatalogEntities(db, ws)
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
            toApiAssessment(row, await getAssessmentStats(db, ws, row, entities), row.project_id)
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
      return toApiAssessment(row, await getAssessmentStats(db, ws, row), project.id);
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

      return toApiAssessment(row, { response_count: 0, completed_entity_count: 0 }, project.id);
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

      const row = await db.project.updateAssessment(
        ws,
        project.id,
        id,
        buildUpdateAssessmentInput(body, existing, new Date())
      );
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

      return toApiAssessment(row, await getAssessmentStats(db, ws, row), project.id);
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

      const row = await db.core.transaction(async tx => {
        const updated = await tx.project.updateAssessment(ws, project.id, id, {
          name: oldRow.name,
          description: oldRow.description,
          status: body.status,
          mode: oldRow.mode,
          scope: oldRow.scope,
          scope_conditions: oldRow.scope_conditions,
          fields: oldRow.fields,
          assigned_team_ids: oldRow.assigned_team_ids,
          due_at: oldRow.due_at,
          updated_at: new Date()
        });
        if (updated) {
          if (oldRow.status !== 'open' && body.status === 'open') {
            await openAssessmentGovernanceCase(tx, ws, authCtx.userId, updated);
          } else if (oldRow.status === 'open' && body.status !== 'open') {
            await closeAssessmentGovernanceCase(tx, ws, updated.id);
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

      return toApiAssessment(row, await getAssessmentStats(db, ws, row), project.id);
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
