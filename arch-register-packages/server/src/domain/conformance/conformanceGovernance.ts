import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications,
  type CreateGovernanceCaseInput
} from '../governance/governanceOperations';
import type { GovernanceRegistry } from '../governance/governanceRegistry';
import { resolveScopeAwareEscalationTarget } from '../governance/governanceOperations';
import { PermissionChecker } from '@arch-register/permissions';
import type {
  ConformanceCheckDbResult,
  ConformanceViolationDbResult
} from './db/conformanceDatabase';

export const CONFORMANCE_VIOLATION_CASE_KIND = 'conformance.violation';

const permissionChecker = new PermissionChecker();

export const createConformanceGovernanceRegistry = (): GovernanceRegistry =>
  new Map([
    [
      CONFORMANCE_VIOLATION_CASE_KIND,
      {
        workflowConfig: {
          supportsSubkind: false,
          supportsWorkspaceScope: true,
          supportsApprovals: false,
          supportsReminders: true,
          supportsEscalation: true,
          supportsInitiationFields: false
        },
        subjectVisible: async (
          db: DatabaseAdapter,
          authCtx: AuthorizationContext,
          workspace: string,
          subjectId: string
        ) => {
          const violation = await db.conformance.getViolation(workspace, subjectId);
          if (!violation) return false;
          const entity = await db.catalog.getEntity(workspace, violation.entity_id);
          return (
            entity != null && permissionChecker.hasEntityPermission(authCtx, entity, 'view_entity')
          );
        },
        handleDecision: async (tx, { case: caseRow, event, decision }) => {
          if (decision !== 'acknowledge') return;
          const violationId = caseRow.payload['violationId'];
          if (typeof violationId !== 'string') return;
          const resolution =
            caseRow.payload['resolution'] === 'resolve' ? 'resolved' : 'acknowledged';
          await tx.conformance.setViolationStatus(
            caseRow.workspace,
            violationId,
            resolution,
            new Date(),
            { caseId: caseRow.id, eventId: event.id, source: 'governance' }
          );
        },
        reminders: { approachingDays: [1], overdueDays: [3] },
        escalation: {
          overdueDays: 3,
          target: async (db, caseRow) =>
            resolveScopeAwareEscalationTarget(db, caseRow.workspace, null)
        }
      }
    ]
  ]);

const caseInputForViolation = (
  check: ConformanceCheckDbResult,
  violation: ConformanceViolationDbResult,
  seenAt: Date
): CreateGovernanceCaseInput => ({
  caseKind: CONFORMANCE_VIOLATION_CASE_KIND,
  subjectType: 'conformance_violation',
  subjectId: violation.id,
  subjectVersion: `${check.id}:${check.revision}`,
  policyVersion: `${check.id}:${check.revision}`,
  dedupeKey: `conformance:${violation.id}`,
  selfApprovalAllowed: true,
  dueAt: new Date(seenAt.getTime() + 7 * 24 * 60 * 60 * 1000),
  payload: {
    checkId: check.id,
    violationId: violation.id,
    resolution: check.definition.governance?.resolution ?? 'acknowledge',
    severity: violation.severity
  },
  assignments: [
    {
      action: 'acknowledge',
      target: { type: 'capability', capability: 'ws.settings' }
    }
  ]
});

export const ensureConformanceGovernanceCase = async (
  db: DatabaseAdapter,
  check: ConformanceCheckDbResult,
  violation: ConformanceViolationDbResult,
  seenAt: Date
) => {
  if (check.definition.governance?.enabled !== true || violation.status === 'exempt') return;
  const existing = await db.governance.getCaseByDedupeKey(
    check.workspace,
    CONFORMANCE_VIOLATION_CASE_KIND,
    `conformance:${violation.id}`
  );
  if (existing) return;
  await db.core.transaction(async tx =>
    createGovernanceCaseInTransaction(
      tx,
      check.workspace,
      null,
      caseInputForViolation(check, violation, seenAt),
      seenAt,
      randomUUID()
    )
  );
};

export const closeConformanceGovernanceCases = async (
  db: DatabaseAdapter,
  workspace: string,
  violationId: string,
  now: Date
) => {
  const cases = await db.governance.listCases(workspace, {
    caseKind: CONFORMANCE_VIOLATION_CASE_KIND,
    subjectType: 'conformance_violation',
    subjectId: violationId,
    status: 'open'
  });
  for (const caseRow of cases) {
    await db.core.transaction(async tx => {
      const completed = await tx.governance.completeCaseIfOpen(caseRow.id, 'resolved', now);
      if (!completed) return;
      const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
      await resolveAssignmentNotifications(tx, supersededIds, now);
      await resolveCaseNotifications(tx, completed.id, now);
      await recordGovernanceEvent(tx, completed, {
        eventType: 'cancelled',
        actorUserId: null,
        previousStatus: 'open',
        resultingStatus: 'completed',
        reason: 'Conformance violation resolved by evaluation',
        metadata: { violationId }
      });
    });
  }
};
