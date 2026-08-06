import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type {
  EntityChangeApprovalDbResult,
  EntityChangeApprovalRevisionDbResult
} from './db/entityChangeDatabase';
import { finalizeApprovalBypass, withdrawApproval } from './approvalLifecycleOperations';

const governanceMocks = vi.hoisted(() => ({
  recordGovernanceEvent: vi.fn(async () => {}),
  resolveAssignmentNotifications: vi.fn(async () => {}),
  resolveCaseNotifications: vi.fn(async () => {})
}));

vi.mock('../governance/governanceOperations', () => governanceMocks);

const now = new Date('2026-06-29T12:00:00.000Z');
const event = {
  context: { user: { id: 'user-1', display_name: 'User' } }
} as AuthenticatedEvent;

const proposal: EntityChangeApprovalDbResult = {
  id: 'approval-1',
  workspace: 'ws-1',
  entity_id: 'record-1',
  status: 'open',
  initiator_user_id: 'user-1',
  created_at: now,
  updated_at: now,
  closed_at: null
};

const revision = {
  id: 'revision-1',
  proposal_id: proposal.id
} as EntityChangeApprovalRevisionDbResult;

const makeDb = () => {
  const updateApprovalRevisionStatus = vi.fn(async () => null);
  const updateApprovalStatus = vi.fn(async () => null);
  const cancelCaseIfOpen = vi.fn(async () => ({ id: 'case-1' }));
  const supersedeAllOpenAssignmentsForCase = vi.fn(async () => ['assignment-1']);
  const db = {
    entityChange: {
      getOpenApproval: vi.fn(async () => proposal),
      getApproval: vi.fn(async () => proposal),
      getLatestApprovalRevision: vi.fn(async () => revision),
      updateApprovalRevisionStatus,
      updateApprovalStatus
    },
    governance: {
      listCases: vi.fn(async () => [{ id: 'case-1', subject_version: revision.id }]),
      cancelCaseIfOpen,
      supersedeAllOpenAssignmentsForCase
    },
    core: {
      transaction: vi.fn(async (fn: (tx: DatabaseAdapter) => unknown) => fn(db as never))
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    updateApprovalRevisionStatus,
    updateApprovalStatus,
    cancelCaseIfOpen,
    supersedeAllOpenAssignmentsForCase
  };
};

describe('withdrawApproval', () => {
  it('withdraws the proposal and cancels its governance case through the adapter kind', async () => {
    const { db, updateApprovalRevisionStatus, updateApprovalStatus, cancelCaseIfOpen } = makeDb();
    const toApiApproval = vi.fn(async () => ({ kind: 'relation' }));

    const result = await withdrawApproval(db, {
      workspace: 'ws-1',
      subjectId: 'record-1',
      proposalId: proposal.id,
      event,
      authCtx: null,
      reason: 'no longer needed',
      adapter: {
        caseKind: 'relation.change-case',
        subjectName: 'Relation',
        toApiApproval
      }
    });

    expect(result).toEqual({ kind: 'relation' });
    expect(db.governance.listCases).toHaveBeenCalledWith('ws-1', {
      caseKind: 'relation.change-case',
      subjectId: 'record-1'
    });
    expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
      'ws-1',
      revision.id,
      'withdrawn',
      expect.any(Date)
    );
    expect(updateApprovalStatus).toHaveBeenCalledWith(
      'ws-1',
      proposal.id,
      'withdrawn',
      expect.any(Date),
      expect.any(Date)
    );
    expect(cancelCaseIfOpen).toHaveBeenCalledWith('case-1', expect.any(Date));
    expect(governanceMocks.recordGovernanceEvent).toHaveBeenLastCalledWith(
      expect.anything(),
      { id: 'case-1' },
      expect.objectContaining({
        eventType: 'cancelled',
        actorUserId: 'user-1',
        reason: 'no longer needed'
      })
    );
  });
});

describe('finalizeApprovalBypass', () => {
  it('approves the superseded proposal and records the administrative override', async () => {
    const { db, updateApprovalRevisionStatus, updateApprovalStatus, cancelCaseIfOpen } = makeDb();

    await finalizeApprovalBypass(db, {
      workspace: 'ws-1',
      subjectId: 'record-1',
      actorUserId: 'admin-1',
      reason: 'urgent fix',
      now,
      adapter: { caseKind: 'entity.change-case' }
    });

    expect(updateApprovalRevisionStatus).toHaveBeenCalledWith('ws-1', revision.id, 'approved', now);
    expect(updateApprovalStatus).toHaveBeenCalledWith('ws-1', proposal.id, 'approved', now, now);
    expect(db.governance.listCases).toHaveBeenCalledWith('ws-1', {
      caseKind: 'entity.change-case',
      subjectId: 'record-1'
    });
    expect(cancelCaseIfOpen).toHaveBeenCalledWith('case-1', now);
    expect(governanceMocks.recordGovernanceEvent).toHaveBeenLastCalledWith(
      expect.anything(),
      { id: 'case-1' },
      expect.objectContaining({
        eventType: 'admin_override',
        actorUserId: 'admin-1',
        reason: 'urgent fix'
      })
    );
  });

  it('does nothing when there is no open proposal', async () => {
    const { db, updateApprovalRevisionStatus } = makeDb();
    vi.mocked(db.entityChange.getOpenApproval).mockResolvedValueOnce(null);

    await finalizeApprovalBypass(db, {
      workspace: 'ws-1',
      subjectId: 'record-1',
      actorUserId: 'admin-1',
      reason: 'urgent fix',
      now,
      adapter: { caseKind: 'entity.change-case' }
    });

    expect(updateApprovalRevisionStatus).not.toHaveBeenCalled();
    expect(db.governance.cancelCaseIfOpen).not.toHaveBeenCalled();
  });
});
