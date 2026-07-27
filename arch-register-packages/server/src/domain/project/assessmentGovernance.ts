import type { DatabaseAdapter } from '../../db/database';
import type { AssessmentDbResult } from './db/projectDatabase';
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
        independentAssignmentActions: new Set(['acknowledge' as const]),
        reminderWindows: { approachingDays: [3], overdueDays: [1, 3] }
      }
    ]
  ]);

export const openAssessmentGovernanceCase = async (
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

export const closeAssessmentGovernanceCase = async (
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
