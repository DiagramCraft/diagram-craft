import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityChangeApprovalDbResult } from './db/entityChangeDatabase';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import {
  recordGovernanceEvent,
  resolveAssignmentNotifications,
  resolveCaseNotifications
} from '../governance/governanceOperations';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';

type ApprovalLifecycleAdapter<TApproval> = {
  caseKind: string;
  subjectName: 'Entity' | 'Relation';
  toApiApproval: (
    db: DatabaseAdapter,
    proposal: EntityChangeApprovalDbResult,
    authCtx: WorkspaceAuthorizationContext | null
  ) => Promise<TApproval>;
};

export const findApprovalCaseForRevision = async (
  db: DatabaseAdapter,
  workspace: string,
  subjectId: string,
  revisionId: string,
  caseKind: string
): Promise<GovernanceCaseDbResult | null> => {
  const cases = await db.governance.listCases(workspace, {
    caseKind,
    subjectId
  });
  return cases.find(candidate => candidate.subject_version === revisionId) ?? null;
};

export const withdrawApproval = async <TApproval>(
  db: DatabaseAdapter,
  params: {
    workspace: string;
    subjectId: string;
    proposalId: string;
    event: AuthenticatedEvent;
    authCtx: WorkspaceAuthorizationContext | null;
    reason?: string;
    adapter: ApprovalLifecycleAdapter<TApproval>;
  }
): Promise<TApproval> => {
  const { workspace, subjectId, proposalId, event, authCtx, reason, adapter } = params;
  const proposal = await db.entityChange.getOpenApproval(workspace, subjectId);
  const subjectLabel = adapter.subjectName.toLowerCase();
  const proposalMessage = `${adapter.subjectName} proposal not found`;
  httpAssert.true(proposal?.id === proposalId, {
    status: 404,
    message: proposalMessage
  });
  httpAssert.present(proposal, { status: 404, message: proposalMessage });
  httpAssert.true(proposal.initiator_user_id === event.context.user.id, {
    status: 403,
    message: 'Only the proposal initiator can withdraw this proposal'
  });

  const revision = await db.entityChange.getLatestApprovalRevision(workspace, proposal.id);
  httpAssert.present(revision, {
    status: 409,
    message: `The ${subjectLabel} proposal has no revision`
  });
  const caseRow = await findApprovalCaseForRevision(
    db,
    workspace,
    subjectId,
    revision.id,
    adapter.caseKind
  );
  httpAssert.present(caseRow, {
    status: 409,
    message: `The ${subjectLabel} proposal case is missing`
  });

  const now = new Date();
  await db.core.transaction(async tx => {
    await tx.entityChange.updateApprovalRevisionStatus(workspace, revision.id, 'withdrawn', now);
    await tx.entityChange.updateApprovalStatus(workspace, proposal.id, 'withdrawn', now, now);
    const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
    if (!cancelled) return;

    const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
    await resolveAssignmentNotifications(tx, supersededIds, now);
    await resolveCaseNotifications(tx, cancelled.id, now);
    await recordGovernanceEvent(tx, cancelled, {
      eventType: 'cancelled',
      actorUserId: event.context.user.id,
      previousStatus: 'open',
      resultingStatus: 'cancelled',
      reason: reason ?? null,
      metadata: { proposalId: proposal.id, revisionId: revision.id }
    });
  });

  return adapter.toApiApproval(
    db,
    (await db.entityChange.getApproval(workspace, proposal.id))!,
    authCtx
  );
};

export const finalizeApprovalBypass = async (
  tx: DatabaseAdapter,
  params: {
    workspace: string;
    subjectId: string;
    actorUserId: string;
    reason: string;
    now: Date;
    adapter: Pick<ApprovalLifecycleAdapter<unknown>, 'caseKind'>;
  }
): Promise<void> => {
  const { workspace, subjectId, actorUserId, reason, now, adapter } = params;
  const proposal = await tx.entityChange.getOpenApproval(workspace, subjectId);
  if (!proposal) return;

  const revision = await tx.entityChange.getLatestApprovalRevision(workspace, proposal.id);
  if (!revision) return;

  await tx.entityChange.updateApprovalRevisionStatus(workspace, revision.id, 'approved', now);
  await tx.entityChange.updateApprovalStatus(workspace, proposal.id, 'approved', now, now);
  const caseRow = await findApprovalCaseForRevision(
    tx,
    workspace,
    subjectId,
    revision.id,
    adapter.caseKind
  );
  if (!caseRow) return;

  const cancelled = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
  if (!cancelled) return;

  const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
  await resolveAssignmentNotifications(tx, supersededIds, now);
  await resolveCaseNotifications(tx, cancelled.id, now);
  await recordGovernanceEvent(tx, cancelled, {
    eventType: 'admin_override',
    actorUserId,
    previousStatus: 'open',
    resultingStatus: 'cancelled',
    reason,
    metadata: { proposalId: proposal.id, revisionId: revision.id }
  });
};
