import { randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiEntityAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type {
  WorkspaceAuthorizationContext,
  AuthorizationContext
} from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type {
  EntityChangeApprovalDbResult,
  EntityChangeApprovalRevisionDbResult
} from './db/entityChangeDatabase';
import type {
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from '../governance/db/governanceDatabase';
import type { GovernanceAssignmentSpec } from '../governance/governanceOperations';
import {
  createGovernanceCaseInTransaction,
  recordGovernanceEvent
} from '../governance/governanceOperations';
import type { GovernanceCaseKindConfig } from '../governance/governanceRegistry';
import { equalEntityValue, mutableStateKeys } from './entityDiff';
import { finalizeApprovalBypass, withdrawApproval } from './approvalLifecycleOperations';
import { runAuthorizedOperation } from '../operation';

export type ApprovalRequestBody = {
  baseVersion: number;
  proposedState: Record<string, unknown>;
  message?: string;
  dueAt?: string;
  initiationFields?: Record<string, unknown>;
};

export type ApprovalBypassRequestBody = ApprovalRequestBody & { reason: string };

export type PreparedApprovalProposal = {
  baseState: Record<string, unknown>;
  proposedState: Record<string, unknown>;
  diff: Record<string, unknown>;
};

export type ApprovalSubmissionMetadata = {
  required: boolean;
  policyVersion: string;
  resolvedPolicy: Record<string, unknown>;
  assignments: GovernanceAssignmentSpec[];
  selfApprovalAllowed: boolean;
  requiredApprovals: number;
  caseSubkind?: string | null;
  casePayload?: Record<string, unknown>;
};

export type ApprovalPolicyMetadata = Pick<ApprovalSubmissionMetadata, 'required' | 'policyVersion'>;

export type ApprovalSubjectAdapter<TSubject, TApproval> = {
  subjectName: 'Entity' | 'Relation';
  subjectType: string;
  caseKind: string;
  getSubject: (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string
  ) => Promise<TSubject | null>;
  getSubjectId: (subject: TSubject) => string;
  getVersion: (subject: TSubject) => number;
  assertCanView: (
    db: DatabaseAdapter,
    workspace: string,
    authCtx: AuthorizationContext,
    subject: TSubject
  ) => Promise<void> | void;
  assertCanPropose: (
    db: DatabaseAdapter,
    workspace: string,
    authCtx: AuthorizationContext,
    subject: TSubject
  ) => Promise<void> | void;
  prepareProposal: (
    db: DatabaseAdapter,
    workspace: string,
    subject: TSubject,
    proposedState: Record<string, unknown>,
    authCtx: AuthorizationContext
  ) => Promise<PreparedApprovalProposal>;
  resolvePolicy: (
    db: DatabaseAdapter,
    workspace: string,
    subject: TSubject
  ) => Promise<ApprovalPolicyMetadata>;
  resolveSubmission: (
    db: DatabaseAdapter,
    workspace: string,
    subject: TSubject,
    userId: string,
    policy: ApprovalPolicyMetadata
  ) => Promise<ApprovalSubmissionMetadata>;
  toApiApproval: (
    db: DatabaseAdapter,
    proposal: EntityChangeApprovalDbResult,
    authCtx: WorkspaceAuthorizationContext | null
  ) => Promise<TApproval>;
  applyBypass: (params: {
    tx: DatabaseAdapter;
    workspace: string;
    subject: TSubject;
    event: AuthenticatedEvent;
    authCtx: AuthorizationContext;
    body: ApprovalBypassRequestBody;
    now: Date;
  }) => Promise<{ version: number } | null>;
  governance: ApprovalGovernanceAdapter<TSubject>;
};

export type ApprovalGovernanceAdapter<TSubject> = {
  subjectName: 'Entity' | 'Relation';
  workflowConfig?: GovernanceCaseKindConfig['workflowConfig'];
  reminders?: GovernanceCaseKindConfig['reminders'];
  escalation?: GovernanceCaseKindConfig['escalation'];
  getSubjectIdFromCase: (caseRow: GovernanceCaseDbResult) => string;
  subjectVisible: (
    db: DatabaseAdapter,
    authCtx: AuthorizationContext,
    workspace: string,
    subjectId: string
  ) => Promise<boolean>;
  getSubject: (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string
  ) => Promise<TSubject | null>;
  toBaseState: (subject: TSubject) => Record<string, unknown>;
  applyDomainEffect: (params: {
    tx: DatabaseAdapter;
    caseRow: GovernanceCaseDbResult;
    event: GovernanceEventDbResult;
    revision: EntityChangeApprovalRevisionDbResult;
    subject: TSubject;
    nextState: Record<string, unknown>;
  }) => Promise<Record<string, unknown> | void>;
  conflictMessage: (subject: TSubject, keys: string[]) => string;
  requiredApprovals?: (caseRow: GovernanceCaseDbResult) => number;
};

const permissionChecker = new PermissionChecker();

const authorizationEventForUser = (userId: string) =>
  ({ context: { user: { id: userId } } }) as unknown as AuthenticatedEvent;

/** Shared approver resolution used by every single-record approval subject. */
export const listEligibleApproverIds = async (
  db: DatabaseAdapter,
  workspace: string,
  ownerTeamId: string | null
) => {
  const [users, teamAssignments] = await Promise.all([
    db.auth.listUsers(),
    db.workspace.listTeamAssignments(workspace)
  ]);
  const activeUserIds = new Set(users.filter(user => user.is_active).map(user => user.id));
  const eligibleApproverIds = new Set(
    teamAssignments
      .filter(
        assignment =>
          ownerTeamId != null &&
          assignment.team_id === ownerTeamId &&
          assignment.role === 'team_admin' &&
          activeUserIds.has(assignment.user_id)
      )
      .map(assignment => assignment.user_id)
  );

  await Promise.all(
    users
      .filter(user => user.is_active)
      .map(async user => {
        // Each candidate user needs a synthetic authorization context to evaluate that candidate's own
        // capabilities; this is background target resolution, not route authorization.
        const authCtx = await buildApiEntityAuthCtx(
          db,
          workspace,
          authorizationEventForUser(user.id)
        );
        if (permissionChecker.hasWorkspaceCapability(authCtx, 'ent.approve')) {
          eligibleApproverIds.add(user.id);
        }
      })
  );

  return eligibleApproverIds;
};

export const isSoleApprover = (eligibleApproverIds: ReadonlySet<string>, userId: string) =>
  eligibleApproverIds.size === 1 && eligibleApproverIds.has(userId);

export const approvalCaseShouldComplete = async ({
  tx,
  case: caseRow,
  assignmentId,
  actorUserId,
  decision,
  requiredApprovals
}: {
  tx: DatabaseAdapter;
  case: GovernanceCaseDbResult;
  assignmentId: string;
  actorUserId: string;
  decision: 'approve' | 'reject' | 'request_changes' | 'acknowledge';
  requiredApprovals: number;
}) => {
  if (decision !== 'approve') return true;
  const events = await tx.governance.listEvents(caseRow.id);
  const approved = events.filter(event => event.event_type === 'approved');
  const actorIds = new Set(approved.map(event => event.actor_user_id).filter(Boolean));
  actorIds.add(actorUserId);
  const assignmentIds = new Set(approved.map(event => String(event.metadata['assignmentId'])));
  assignmentIds.add(assignmentId);
  return assignmentIds.size >= requiredApprovals && actorIds.size >= requiredApprovals;
};

export const approvalConflictKeys = (
  baseState: Record<string, unknown>,
  currentState: Record<string, unknown>,
  proposedState: Record<string, unknown>,
  diff: Record<string, unknown>
) =>
  Object.keys(diff).filter(
    key =>
      !equalEntityValue(baseState[key], currentState[key]) &&
      !equalEntityValue(currentState[key], proposedState[key])
  );

export const mergeApprovalState = (
  currentState: Record<string, unknown>,
  proposedState: Record<string, unknown>,
  diff: Record<string, unknown>
) => {
  const next = { ...proposedState };
  for (const key of mutableStateKeys) {
    if (!Object.hasOwn(diff, key)) next[key] = currentState[key];
  }
  return next;
};

const getSubjectOrThrow = async <TSubject>(
  db: DatabaseAdapter,
  workspace: string,
  subjectId: string,
  adapter: Pick<ApprovalSubjectAdapter<TSubject, never>, 'getSubject' | 'subjectName'>
) => {
  const subject = await adapter.getSubject(db, workspace, subjectId);
  httpAssert.present(subject, {
    status: 404,
    message: `${adapter.subjectName} not found`
  });
  return subject;
};

export const createApprovalWorkflow = <TSubject, TApproval>(
  adapter: ApprovalSubjectAdapter<TSubject, TApproval>
) => {
  const loadForView = async (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string,
    authCtx: AuthorizationContext
  ) => {
    const subject = await getSubjectOrThrow(db, workspace, subjectId, adapter);
    await adapter.assertCanView(db, workspace, authCtx, subject);
    return subject;
  };

  const loadForProposal = async (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string,
    authCtx: AuthorizationContext
  ) => {
    const subject = await getSubjectOrThrow(db, workspace, subjectId, adapter);
    await adapter.assertCanPropose(db, workspace, authCtx, subject);
    requireWorkspaceCapability(authCtx, 'ent.propose');
    return subject;
  };

  const get = (
    db: DatabaseAdapter,
    workspaceName: string,
    subjectId: string,
    event: AuthenticatedEvent
  ): Promise<TApproval | null> =>
    runAuthorizedOperation({
      db,
      event,
      scope: { kind: 'entity', workspace: workspaceName },
      operation: async ({ ws, authCtx }) => {
        const subject = await loadForView(db, ws, subjectId, authCtx);
        const proposal = await db.entityChange.getOpenApproval(ws, adapter.getSubjectId(subject));
        return proposal ? adapter.toApiApproval(db, proposal, authCtx) : null;
      }
    });

  const submitWithContext = async (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string,
    event: AuthenticatedEvent,
    authCtx: AuthorizationContext,
    body: ApprovalRequestBody,
    expectedProposalId?: string
  ): Promise<TApproval> => {
    const subject = await loadForProposal(db, workspace, subjectId, authCtx);
    const policy = await adapter.resolvePolicy(db, workspace, subject);
    httpAssert.true(policy.required, {
      status: 409,
      statusText: 'Conflict',
      message: `This ${adapter.subjectName.toLowerCase()} does not require an approval proposal`
    });
    const prepared = await adapter.prepareProposal(
      db,
      workspace,
      subject,
      body.proposedState,
      authCtx
    );
    httpAssert.true(Object.keys(prepared.diff).length > 0, {
      status: 400,
      message: `The proposal does not change the ${adapter.subjectName.toLowerCase()}`
    });
    httpAssert.true(body.baseVersion === adapter.getVersion(subject), {
      status: 409,
      statusText: 'Conflict',
      message: `The ${adapter.subjectName.toLowerCase()} changed while this proposal was being edited`
    });
    const metadata = await adapter.resolveSubmission(
      db,
      workspace,
      subject,
      event.context.user.id,
      policy
    );

    const canonicalSubjectId = adapter.getSubjectId(subject);
    const userId = event.context.user.id;
    const now = new Date();
    const proposal = await db.core.transaction(async tx => {
      let root = await tx.entityChange.getOpenApproval(workspace, canonicalSubjectId);
      if (expectedProposalId != null) {
        httpAssert.true(root?.id === expectedProposalId, {
          status: 404,
          message: `${adapter.subjectName} proposal not found`
        });
      }
      if (root == null) {
        root = await tx.entityChange.createApproval({
          id: randomUUID(),
          workspace,
          entity_id: canonicalSubjectId,
          status: 'open',
          initiator_user_id: userId,
          created_at: now,
          updated_at: now,
          closed_at: null
        });
      } else {
        httpAssert.true(root.initiator_user_id === userId, {
          status: 403,
          message: 'Only the proposal initiator can submit a new revision'
        });
        const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
        httpAssert.true(previous?.status === 'changes_requested' || previous?.status === 'stale', {
          status: 409,
          message: `The current ${adapter.subjectName.toLowerCase()} proposal is already awaiting a decision`
        });
      }

      const previous = await tx.entityChange.getLatestApprovalRevision(workspace, root.id);
      const revision = await tx.entityChange.createApprovalRevision({
        id: randomUUID(),
        proposal_id: root.id,
        workspace,
        entity_id: canonicalSubjectId,
        revision_number: (previous?.revision_number ?? 0) + 1,
        base_version: body.baseVersion,
        base_state: prepared.baseState,
        proposed_state: prepared.proposedState,
        diff: prepared.diff,
        policy_version: metadata.policyVersion,
        resolved_policy: metadata.resolvedPolicy,
        message: body.message ?? null,
        created_by: userId,
        status: 'submitted',
        created_at: now,
        resolved_at: null
      });

      await createGovernanceCaseInTransaction(
        tx,
        workspace,
        userId,
        {
          caseKind: adapter.caseKind,
          caseSubkind: metadata.caseSubkind,
          subjectType: adapter.subjectType,
          subjectId: canonicalSubjectId,
          subjectVersion: revision.id,
          policyVersion: metadata.policyVersion,
          selfApprovalAllowed: metadata.selfApprovalAllowed,
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          payload: {
            proposalId: root.id,
            revisionId: revision.id,
            ...metadata.casePayload,
            requiredApprovals: metadata.requiredApprovals
          },
          initiationFieldValues: body.initiationFields,
          assignments: metadata.assignments
        },
        now
      );
      return root;
    });

    return adapter.toApiApproval(db, proposal, authCtx);
  };

  const submit = (
    db: DatabaseAdapter,
    workspaceName: string,
    subjectId: string,
    event: AuthenticatedEvent,
    body: ApprovalRequestBody
  ): Promise<TApproval> =>
    runAuthorizedOperation({
      db,
      event,
      scope: { kind: 'entity', workspace: workspaceName },
      operation: ({ ws, authCtx }) => submitWithContext(db, ws, subjectId, event, authCtx, body)
    });

  const resubmit = (
    db: DatabaseAdapter,
    workspaceName: string,
    subjectId: string,
    proposalId: string,
    event: AuthenticatedEvent,
    body: ApprovalRequestBody
  ): Promise<TApproval> =>
    runAuthorizedOperation({
      db,
      event,
      scope: { kind: 'entity', workspace: workspaceName },
      operation: ({ ws, authCtx }) =>
        submitWithContext(db, ws, subjectId, event, authCtx, body, proposalId)
    });

  const withdrawWithContext = async (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string,
    proposalId: string,
    event: AuthenticatedEvent,
    authCtx: AuthorizationContext,
    reason?: string
  ): Promise<TApproval> => {
    const subject = await loadForProposal(db, workspace, subjectId, authCtx);
    return withdrawApproval(db, {
      workspace,
      subjectId: adapter.getSubjectId(subject),
      proposalId,
      event,
      authCtx,
      reason,
      adapter: {
        caseKind: adapter.caseKind,
        subjectName: adapter.subjectName,
        toApiApproval: adapter.toApiApproval
      }
    });
  };

  const withdraw = (
    db: DatabaseAdapter,
    workspaceName: string,
    subjectId: string,
    proposalId: string,
    event: AuthenticatedEvent,
    reason?: string
  ): Promise<TApproval> =>
    runAuthorizedOperation({
      db,
      event,
      scope: { kind: 'entity', workspace: workspaceName },
      operation: ({ ws, authCtx }) =>
        withdrawWithContext(db, ws, subjectId, proposalId, event, authCtx, reason)
    });

  const bypassWithContext = async (
    db: DatabaseAdapter,
    workspace: string,
    subjectId: string,
    event: AuthenticatedEvent,
    authCtx: AuthorizationContext,
    body: ApprovalBypassRequestBody
  ) => {
    const subject = await loadForProposal(db, workspace, subjectId, authCtx);
    requireWorkspaceCapability(authCtx, 'ent.override');
    const canonicalSubjectId = adapter.getSubjectId(subject);
    const updated = await db.core.transaction(async tx => {
      const now = new Date();
      if (adapter.getVersion(subject) !== body.baseVersion) return null;
      const row = await adapter.applyBypass({
        tx,
        workspace,
        subject,
        event,
        authCtx,
        body,
        now
      });
      if (row == null) return null;

      await finalizeApprovalBypass(tx, {
        workspace,
        subjectId: canonicalSubjectId,
        actorUserId: event.context.user.id,
        reason: body.reason,
        now,
        adapter: { caseKind: adapter.caseKind }
      });
      return row;
    });
    httpAssert.present(updated, {
      status: 409,
      statusText: 'Conflict',
      message: `The ${adapter.subjectName.toLowerCase()} changed while the bypass was being applied`
    });
    return { subjectId: canonicalSubjectId, version: updated.version, bypassed: true as const };
  };

  const bypass = (
    db: DatabaseAdapter,
    workspaceName: string,
    subjectId: string,
    event: AuthenticatedEvent,
    body: ApprovalBypassRequestBody
  ) =>
    runAuthorizedOperation({
      db,
      event,
      scope: { kind: 'entity', workspace: workspaceName },
      operation: ({ ws, authCtx }) => bypassWithContext(db, ws, subjectId, event, authCtx, body)
    });

  return { get, submit, resubmit, withdraw, bypass };
};

export const createApprovalGovernanceCaseConfig = <TSubject>(
  adapter: ApprovalGovernanceAdapter<TSubject>
): GovernanceCaseKindConfig => ({
  workflowConfig: adapter.workflowConfig,
  subjectVisible: adapter.subjectVisible,
  beforeDecision: async (tx, { case: caseRow, decision }) => {
    if (decision !== 'approve') return 'proceed';
    const revision = await tx.entityChange.getApprovalRevision(
      caseRow.workspace,
      String(caseRow.payload['revisionId'])
    );
    const subjectId = adapter.getSubjectIdFromCase(caseRow);
    const subject = await adapter.getSubject(tx, caseRow.workspace, subjectId);
    if (!revision || !subject) return 'proceed';
    const conflicting = approvalConflictKeys(
      revision.base_state,
      adapter.toBaseState(subject),
      revision.proposed_state,
      revision.diff
    );
    if (conflicting.length === 0) return 'proceed';
    await tx.entityChange.updateApprovalRevisionStatus(
      caseRow.workspace,
      revision.id,
      'stale',
      new Date()
    );
    return 'stale';
  },
  shouldCompleteCase: context =>
    approvalCaseShouldComplete({
      ...context,
      requiredApprovals:
        adapter.requiredApprovals?.(context.case) ??
        (Number(context.case.payload['requiredApprovals']) || 1)
    }),
  handleDecision: async (tx, { case: caseRow, decision }) => {
    const revisionId = String(caseRow.payload['revisionId']);
    const proposalId = String(caseRow.payload['proposalId']);
    if (decision === 'request_changes') {
      await tx.entityChange.updateApprovalRevisionStatus(
        caseRow.workspace,
        revisionId,
        'changes_requested'
      );
    } else if (decision === 'reject') {
      const now = new Date();
      await tx.entityChange.updateApprovalRevisionStatus(
        caseRow.workspace,
        revisionId,
        'rejected',
        now
      );
      await tx.entityChange.updateApprovalStatus(
        caseRow.workspace,
        proposalId,
        'rejected',
        now,
        now
      );
    }
  },
  applyDomainEffect: async (tx, { case: caseRow, event }) => {
    const revisionId = String(caseRow.payload['revisionId']);
    const proposalId = String(caseRow.payload['proposalId']);
    const subjectId = adapter.getSubjectIdFromCase(caseRow);
    const revision = await tx.entityChange.getApprovalRevision(caseRow.workspace, revisionId);
    httpAssert.present(revision, {
      status: 409,
      message: 'The proposal revision no longer exists'
    });
    const subject = await adapter.getSubject(tx, caseRow.workspace, subjectId);
    httpAssert.present(subject, {
      status: 409,
      message: `The governed ${adapter.subjectName.toLowerCase()} no longer exists`
    });
    const currentState = adapter.toBaseState(subject);
    const conflictingKeys = approvalConflictKeys(
      revision.base_state,
      currentState,
      revision.proposed_state,
      revision.diff
    );
    httpAssert.true(conflictingKeys.length === 0, {
      status: 409,
      statusText: 'Conflict',
      message: adapter.conflictMessage(subject, conflictingKeys)
    });
    const nextState = mergeApprovalState(currentState, revision.proposed_state, revision.diff);
    const effectMetadata =
      (await adapter.applyDomainEffect({
        tx,
        caseRow,
        event,
        revision,
        subject,
        nextState
      })) ?? {};
    const now = new Date();
    await tx.entityChange.updateApprovalRevisionStatus(
      caseRow.workspace,
      revisionId,
      'approved',
      now
    );
    await tx.entityChange.updateApprovalStatus(caseRow.workspace, proposalId, 'approved', now, now);
    await recordGovernanceEvent(tx, caseRow, {
      eventType: 'domain_effect_applied',
      actorUserId: event.actor_user_id,
      previousStatus: caseRow.status,
      resultingStatus: caseRow.status,
      reason: null,
      metadata: { proposalId, revisionId, ...effectMetadata }
    });
  },
  reminders: adapter.reminders,
  escalation: adapter.escalation
});
