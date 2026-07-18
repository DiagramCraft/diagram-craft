import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type {
  GovernanceAssignmentDbResult,
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from './db/governanceDatabase';
import { decideGovernanceAssignment } from './governanceOperations';
import type { GovernanceRegistry } from './governanceRegistry';

const authCtxMock = {
  userId: 'user-1',
  globalPermissions: new Set(),
  workspaceRole: 'owner',
  workspaceRoles: new Map(),
  teamRolesByTeam: new Map(),
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => authCtxMock),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../jobs/jobOperations', () => ({
  enqueueOneOffJobRun: vi.fn(async () => {})
}));

vi.mock('node:crypto', () => ({
  randomUUID: () => 'event-generated'
}));

const now = new Date('2026-06-01T12:00:00.000Z');

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeCase = (overrides: Partial<GovernanceCaseDbResult> = {}): GovernanceCaseDbResult => ({
  id: 'case-1',
  workspace: 'ws-1',
  case_kind: 'test.echo',
  subject_type: 'entity',
  subject_id: 'entity-1',
  subject_version: null,
  status: 'open',
  outcome: null,
  policy_version: null,
  initiator_user_id: 'user-2',
  parent_case_id: null,
  self_approval_allowed: false,
  payload: {},
  created_at: now,
  due_at: null,
  completed_at: null,
  cancelled_at: null,
  ...overrides
});

const makeAssignment = (
  overrides: Partial<GovernanceAssignmentDbResult> = {}
): GovernanceAssignmentDbResult => ({
  id: 'assignment-1',
  case_id: 'case-1',
  workspace: 'ws-1',
  action: 'approve',
  target_type: 'user',
  target_user_id: 'user-1',
  target_team_id: null,
  target_team_role: null,
  target_capability: null,
  status: 'open',
  created_at: now,
  resolved_at: null,
  ...overrides
});

/** A minimal in-memory GovernanceDatabase double, reused as both `db.governance` and the
 * transaction-bound `tx.governance` since these tests don't need real transaction isolation. */
type GovernanceSnapshot = {
  cases: Map<string, GovernanceCaseDbResult>;
  assignments: Map<string, GovernanceAssignmentDbResult>;
  events: GovernanceEventDbResult[];
  decisionRequests: Map<string, string>;
};

const makeGovernanceDouble = (
  caseRow: GovernanceCaseDbResult,
  assignment: GovernanceAssignmentDbResult
) => {
  const cases = new Map([[caseRow.id, caseRow]]);
  const assignments = new Map([[assignment.id, assignment]]);
  const events: GovernanceEventDbResult[] = [];
  const decisionRequests = new Map<string, string>();

  return {
    getCase: vi.fn(async (_ws: string, id: string) => cases.get(id) ?? null),
    listAssignmentsForCase: vi.fn(async (caseId: string) =>
      [...assignments.values()].filter(a => a.case_id === caseId)
    ),
    getAssignment: vi.fn(async (id: string) => assignments.get(id) ?? null),
    completeAssignmentIfOpen: vi.fn(async (id: string, resolvedAt: Date) => {
      const existing = assignments.get(id);
      if (!existing || existing.status !== 'open') return null;
      const updated = { ...existing, status: 'completed' as const, resolved_at: resolvedAt };
      assignments.set(id, updated);
      return updated;
    }),
    supersedeOpenSiblingAssignments: vi.fn(async () => {}),
    supersedeAllOpenAssignmentsForCase: vi.fn(async () => {}),
    completeCaseIfOpen: vi.fn(async (id: string, outcome: string | null, completedAt: Date) => {
      const existing = cases.get(id);
      if (!existing || existing.status !== 'open') return null;
      const updated = {
        ...existing,
        status: 'completed' as const,
        outcome,
        completed_at: completedAt
      };
      cases.set(id, updated);
      return updated;
    }),
    appendEvent: vi.fn(async input => {
      const created: GovernanceEventDbResult = { ...input };
      events.push(created);
      return created;
    }),
    listEvents: vi.fn(async (caseId: string) => events.filter(e => e.case_id === caseId)),
    findDecisionRequest: vi.fn(async (assignmentId: string, idempotencyKey: string) => {
      const eventId = decisionRequests.get(`${assignmentId}:${idempotencyKey}`);
      return eventId ? { eventId } : null;
    }),
    recordDecisionRequest: vi.fn(
      async (assignmentId: string, idempotencyKey: string, eventId: string) => {
        decisionRequests.set(`${assignmentId}:${idempotencyKey}`, eventId);
      }
    ),
    // Test-only: snapshot/restore so `makeDb`'s transaction wrapper can simulate rollback.
    _snapshot: (): GovernanceSnapshot => ({
      cases: new Map(cases),
      assignments: new Map(assignments),
      events: [...events],
      decisionRequests: new Map(decisionRequests)
    }),
    _restore: (snapshot: GovernanceSnapshot) => {
      cases.clear();
      snapshot.cases.forEach((v, k) => cases.set(k, v));
      assignments.clear();
      snapshot.assignments.forEach((v, k) => assignments.set(k, v));
      events.length = 0;
      events.push(...snapshot.events);
      decisionRequests.clear();
      snapshot.decisionRequests.forEach((v, k) => decisionRequests.set(k, v));
    }
  };
};

const makeDb = (governance: ReturnType<typeof makeGovernanceDouble>): DatabaseAdapter =>
  ({
    catalog: {},
    governance,
    core: {
      driver: 'sqlite' as const,
      transaction: async (callback: (db: DatabaseAdapter) => Promise<unknown>) => {
        const snapshot = governance._snapshot();
        try {
          return await callback(makeDb(governance));
        } catch (error) {
          governance._restore(snapshot);
          throw error;
        }
      }
    }
  }) as unknown as DatabaseAdapter;

describe('decideGovernanceAssignment', () => {
  it('denies self-approval by default', async () => {
    const caseRow = makeCase({ initiator_user_id: 'user-1', self_approval_allowed: false });
    const assignment = makeAssignment();
    const db = makeDb(makeGovernanceDouble(caseRow, assignment));

    await expect(
      decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
        decision: 'approve',
        idempotencyKey: 'key-1'
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows self-approval when the case explicitly permits it', async () => {
    const caseRow = makeCase({ initiator_user_id: 'user-1', self_approval_allowed: true });
    const assignment = makeAssignment();
    const db = makeDb(makeGovernanceDouble(caseRow, assignment));

    const result = await decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
      decision: 'approve',
      idempotencyKey: 'key-1'
    });

    expect(result.case.status).toBe('completed');
    expect(result.case.outcome).toBe('approve');
  });

  it('rejects a decision from a user who is not eligible for the assignment', async () => {
    const caseRow = makeCase();
    const assignment = makeAssignment({ target_user_id: 'someone-else' });
    const db = makeDb(makeGovernanceDouble(caseRow, assignment));

    await expect(
      decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
        decision: 'approve',
        idempotencyKey: 'key-1'
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('replays the original result for a duplicate request with the same idempotency key', async () => {
    const caseRow = makeCase();
    const assignment = makeAssignment();
    const governance = makeGovernanceDouble(caseRow, assignment);
    const db = makeDb(governance);

    const first = await decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
      decision: 'approve',
      idempotencyKey: 'key-1'
    });
    const second = await decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
      decision: 'approve',
      idempotencyKey: 'key-1'
    });

    expect(second.event.id).toBe(first.event.id);
    // Only the first request should have completed the assignment.
    expect(governance.completeAssignmentIfOpen).toHaveBeenCalledTimes(1);
  });

  it('rejects a second decision with a different idempotency key once the assignment is resolved', async () => {
    const caseRow = makeCase();
    const assignment = makeAssignment();
    const db = makeDb(makeGovernanceDouble(caseRow, assignment));

    await decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
      decision: 'approve',
      idempotencyKey: 'key-1'
    });

    await expect(
      decideGovernanceAssignment(db, 'ws-1', assignment.id, event, {
        decision: 'approve',
        idempotencyKey: 'key-2'
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rolls back the decision when the synchronous domain effect throws', async () => {
    const caseRow = makeCase();
    const assignment = makeAssignment();
    const governance = makeGovernanceDouble(caseRow, assignment);
    const db = makeDb(governance);
    const registry: GovernanceRegistry = new Map([
      [
        'test.echo',
        {
          applyDomainEffect: vi.fn(async () => {
            throw new Error('boom');
          })
        }
      ]
    ]);

    await expect(
      decideGovernanceAssignment(
        db,
        'ws-1',
        assignment.id,
        event,
        { decision: 'approve', idempotencyKey: 'key-1' },
        registry
      )
    ).rejects.toThrow('boom');

    // makeDb's transaction wrapper simulates rollback on throw: the assignment must be open
    // again and no decision request should have been recorded, so a retry can succeed cleanly
    // instead of being treated as an idempotent replay of a decision that never really happened.
    expect((await governance.getAssignment(assignment.id))?.status).toBe('open');
    expect(await governance.findDecisionRequest(assignment.id, 'key-1')).toBeNull();

    const retryRegistry: GovernanceRegistry = new Map([['test.echo', {}]]);
    const retried = await decideGovernanceAssignment(
      db,
      'ws-1',
      assignment.id,
      event,
      { decision: 'approve', idempotencyKey: 'key-2' },
      retryRegistry
    );
    expect(retried.case.status).toBe('completed');
  });
});
