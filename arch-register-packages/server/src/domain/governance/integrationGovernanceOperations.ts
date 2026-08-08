import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import {
  createGovernanceCaseInTransaction,
  decideGovernanceAssignment,
  recordGovernanceEvent,
  toApiAssignment,
  toApiCase,
  type CreateGovernanceCaseInput,
  type GovernanceAssignmentSpec
} from './governanceOperations';
import { createApplicationGovernanceRegistry } from './governanceRegistryFactory';
import { resolveGovernanceWorkflowMode } from './governanceWorkflowConfig';
import type {
  IntegrationGovernanceCaseCreate,
  IntegrationGovernanceDecision,
  IntegrationGovernanceInboxItemCreate,
  IntegrationGovernanceTarget
} from '@arch-register/api-types/integrationGovernanceContract';
import type { GovernanceAssignmentDbResult } from './db/governanceDatabase';
import type { WorkspaceCapability } from '@arch-register/permissions';

const registry = createApplicationGovernanceRegistry();

const requireIntegrationAccess = async (
  db: DatabaseAdapter,
  workspaceName: string,
  event: AuthenticatedEvent
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceName);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'governance.external');
  requireWorkspaceCapability(authCtx, 'ws.view');
  return workspace;
};

const requireExternalWorkflow = async (
  db: DatabaseAdapter,
  workspace: string,
  caseKind: string,
  caseSubkind: string | null
) => {
  const kindConfig = registry.get(caseKind);
  httpAssert.present(kindConfig, {
    status: 404,
    message: `Unknown governance case kind '${caseKind}'`
  });
  const resolved = await resolveGovernanceWorkflowMode(
    db,
    workspace,
    caseKind,
    caseSubkind,
    registry
  );
  httpAssert.true(resolved.config.external === true, {
    status: 409,
    statusText: 'Conflict',
    message: `Governance workflow '${caseKind}' is not configured as external`
  });
  return resolved;
};

const targetToSpec = (
  target: IntegrationGovernanceTarget,
  action: GovernanceAssignmentSpec['action']
): GovernanceAssignmentSpec => ({
  action,
  target:
    target.type === 'user'
      ? { type: 'user', userId: target.userId }
      : target.type === 'team'
        ? { type: 'team', teamId: target.teamId }
        : target.type === 'team_role'
          ? { type: 'team_role', teamId: target.teamId, teamRole: target.teamRole }
          : {
              type: 'capability',
              capability: target.capability as WorkspaceCapability
            }
});

const deterministicAssignmentId = (workspace: string, caseId: string, key: string) => {
  const hex = createHash('sha256')
    .update(`${workspace}:${caseId}:${key}`)
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${(
    8 + (Number.parseInt(hex[16]!, 16) % 4)
  ).toString(16)}${hex.slice(17, 20)}-${hex.slice(20)}`;
};

const toInboxItem = (
  assignment: GovernanceAssignmentDbResult,
  caseRow: Awaited<ReturnType<DatabaseAdapter['governance']['getCase']>>
) => {
  httpAssert.present(caseRow, { status: 404, message: 'Governance case not found' });
  return { assignment: toApiAssignment(assignment), case: toApiCase(caseRow) };
};

export const listIntegrationGovernanceCases = async (
  db: DatabaseAdapter,
  workspaceName: string,
  event: AuthenticatedEvent,
  query: {
    caseKind?: string;
    status?: 'open' | 'completed' | 'cancelled';
    subjectType?: string;
    subjectId?: string;
  }
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const rows = await db.governance.listCases(workspace, query);
  const external = await Promise.all(
    rows.map(async row => {
      const resolved = await resolveGovernanceWorkflowMode(
        db,
        workspace,
        row.case_kind,
        row.case_subkind,
        registry
      );
      return resolved.config.external === true ? row : null;
    })
  );
  return external.filter(row => row != null).map(toApiCase);
};

export const getIntegrationGovernanceCase = async (
  db: DatabaseAdapter,
  workspaceName: string,
  caseId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const row = await db.governance.getCase(workspace, caseId);
  httpAssert.present(row, { status: 404, message: 'Governance case not found' });
  await requireExternalWorkflow(db, workspace, row.case_kind, row.case_subkind);
  return toApiCase(row);
};

export const createIntegrationGovernanceCase = async (
  db: DatabaseAdapter,
  workspaceName: string,
  input: IntegrationGovernanceCaseCreate,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const caseSubkind = input.caseSubkind ?? null;
  await requireExternalWorkflow(db, workspace, input.caseKind, caseSubkind);
  const dedupeKey = input.dedupeKey ?? `integration:${input.idempotencyKey}`;
  const existing = await db.governance.getCaseByDedupeKey(workspace, input.caseKind, dedupeKey);
  if (existing) return toApiCase(existing);

  const assignments = input.inboxItems.map(item => targetToSpec(item.target, item.action));
  const createInput: CreateGovernanceCaseInput = {
    caseKind: input.caseKind,
    caseSubkind,
    dedupeKey,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectVersion: input.subjectVersion ?? null,
    policyVersion: input.policyVersion ?? null,
    selfApprovalAllowed: input.selfApprovalAllowed,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    payload: input.payload,
    assignments,
    allowEmptyAssignments: true,
    createAssignmentsInExternalMode: true
  };
  const created = await db.core.transaction(async tx =>
    createGovernanceCaseInTransaction(
      tx,
      workspace,
      event.context.user.id,
      createInput,
      new Date(),
      randomUUID()
    )
  );
  return toApiCase(created);
};

export const listIntegrationGovernanceInboxItems = async (
  db: DatabaseAdapter,
  workspaceName: string,
  caseId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const caseRow = await db.governance.getCase(workspace, caseId);
  httpAssert.present(caseRow, { status: 404, message: 'Governance case not found' });
  await requireExternalWorkflow(db, workspace, caseRow.case_kind, caseRow.case_subkind);
  const assignments = await db.governance.listAssignmentsForCase(caseId);
  return assignments.map(assignment => toInboxItem(assignment, caseRow));
};

export const createIntegrationGovernanceInboxItem = async (
  db: DatabaseAdapter,
  workspaceName: string,
  caseId: string,
  input: IntegrationGovernanceInboxItemCreate,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const caseRow = await db.governance.getCase(workspace, caseId);
  httpAssert.present(caseRow, { status: 404, message: 'Governance case not found' });
  await requireExternalWorkflow(db, workspace, caseRow.case_kind, caseRow.case_subkind);
  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'Only open governance cases can receive inbox items'
  });

  const assignmentId = deterministicAssignmentId(workspace, caseId, input.idempotencyKey);
  const spec = targetToSpec(input.target, input.action);
  const existing = await db.governance.getAssignment(assignmentId);
  if (existing) {
    httpAssert.true(existing.case_id === caseId && existing.action === spec.action, {
      status: 409,
      statusText: 'Conflict',
      message: 'Inbox-item idempotency key was reused'
    });
    return toInboxItem(existing, caseRow);
  }

  const assignment = await db.core.transaction(async tx => {
    const created = await tx.governance.createAssignment({
      id: assignmentId,
      case_id: caseId,
      workspace,
      action: spec.action,
      target_type: spec.target.type,
      target_user_id: spec.target.type === 'user' ? spec.target.userId : null,
      target_team_id:
        spec.target.type === 'team' || spec.target.type === 'team_role' ? spec.target.teamId : null,
      target_team_role: spec.target.type === 'team_role' ? spec.target.teamRole : null,
      target_capability: spec.target.type === 'capability' ? spec.target.capability : null,
      created_at: new Date()
    });
    await recordGovernanceEvent(tx, caseRow, {
      eventType: 'assigned',
      actorUserId: event.context.user.id,
      previousStatus: caseRow.status,
      resultingStatus: caseRow.status,
      reason: null,
      metadata: { assignmentId, trigger: 'external_integration' }
    });
    return created;
  });
  return toInboxItem(assignment, caseRow);
};

export const getIntegrationGovernanceInboxItem = async (
  db: DatabaseAdapter,
  workspaceName: string,
  assignmentId: string,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const assignment = await db.governance.getAssignment(assignmentId);
  httpAssert.present(assignment, { status: 404, message: 'Governance inbox item not found' });
  httpAssert.true(assignment.workspace === workspace, {
    status: 404,
    message: 'Governance inbox item not found'
  });
  const caseRow = await db.governance.getCase(workspace, assignment.case_id);
  httpAssert.present(caseRow, { status: 404, message: 'Governance case not found' });
  await requireExternalWorkflow(db, workspace, caseRow.case_kind, caseRow.case_subkind);
  return toInboxItem(assignment, caseRow);
};

export const decideIntegrationGovernanceInboxItem = async (
  db: DatabaseAdapter,
  workspaceName: string,
  assignmentId: string,
  input: IntegrationGovernanceDecision,
  event: AuthenticatedEvent
) => {
  const workspace = await requireIntegrationAccess(db, workspaceName, event);
  const assignment = await db.governance.getAssignment(assignmentId);
  httpAssert.present(assignment, { status: 404, message: 'Governance inbox item not found' });
  httpAssert.true(assignment.workspace === workspace, {
    status: 404,
    message: 'Governance inbox item not found'
  });
  const caseRow = await db.governance.getCase(workspace, assignment.case_id);
  httpAssert.present(caseRow, { status: 404, message: 'Governance case not found' });
  await requireExternalWorkflow(db, workspace, caseRow.case_kind, caseRow.case_subkind);
  return decideGovernanceAssignment(db, workspaceName, assignmentId, event, input, registry, {
    externalIntegration: true
  });
};
