import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type {
  GovernanceAssignmentDbResult,
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from './db/governanceDatabase';
import type { GovernanceCaseListFilter } from './db/governanceDatabase';
import { decideGovernanceAssignment, listMySubmittedGovernanceCases } from './governanceOperations';
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
  assignment: GovernanceAssignmentDbResult,
  extraAssignments: GovernanceAssignmentDbResult[] = [],
  extraCases: GovernanceCaseDbResult[] = []
) => {
  const cases = new Map([caseRow, ...extraCases].map(c => [c.id, c] as const));
  const assignments = new Map([assignment, ...extraAssignments].map(a => [a.id, a] as const));
  const events: GovernanceEventDbResult[] = [];
  const decisionRequests = new Map<string, string>();

  return {
    getCase: vi.fn(async (_ws: string, id: string) => cases.get(id) ?? null),
    listCases: vi.fn(async (workspace: string, filter: GovernanceCaseListFilter = {}) =>
      [...cases.values()].filter(
        c =>
          c.workspace === workspace &&
          (!filter.caseKind || c.case_kind === filter.caseKind) &&
          (!filter.status || c.status === filter.status) &&
          (!filter.subjectType || c.subject_type === filter.subjectType) &&
          (!filter.subjectId || c.subject_id === filter.subjectId) &&
          (!filter.initiatorUserId || c.initiator_user_id === filter.initiatorUserId)
      )
    ),
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
    supersedeOpenSiblingAssignments: vi.fn(
      async (caseId: string, action: string, decidedAssignmentId: string) =>
        [...assignments.values()]
          .filter(
            a =>
              a.case_id === caseId &&
              a.action === action &&
              a.id !== decidedAssignmentId &&
              a.status === 'open'
          )
          .map(a => a.id)
    ),
    supersedeAllOpenAssignmentsForCase: vi.fn(async (caseId: string) =>
      [...assignments.values()]
        .filter(a => a.case_id === caseId && a.status === 'open')
        .map(a => a.id)
    ),
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
    notification: {
      markReadByAssignmentIds: vi.fn(async () => 0),
      markReadByCaseIds: vi.fn(async () => 0)
    },
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

  describe('independent assignments (#1718 group acknowledgement)', () => {
    const registryWithIndependentAck: GovernanceRegistry = new Map([
      ['test.echo', { independentAssignmentActions: new Set(['acknowledge']) }]
    ]);

    it('completes the assignment without completing the case or superseding siblings', async () => {
      const caseRow = makeCase();
      const assignmentA = makeAssignment({
        id: 'assignment-a',
        action: 'acknowledge',
        target_user_id: 'user-1'
      });
      const governance = makeGovernanceDouble(caseRow, assignmentA);
      const db = makeDb(governance);

      const result = await decideGovernanceAssignment(
        db,
        'ws-1',
        assignmentA.id,
        event,
        { decision: 'acknowledge', idempotencyKey: 'key-1' },
        registryWithIndependentAck
      );

      expect(result.case.status).toBe('open');
      expect((await governance.getAssignment(assignmentA.id))?.status).toBe('completed');
      expect(governance.supersedeOpenSiblingAssignments).not.toHaveBeenCalled();
      expect(governance.supersedeAllOpenAssignmentsForCase).not.toHaveBeenCalled();
    });

    it('leaves a sibling independent assignment open and decidable after another is decided', async () => {
      const caseRow = makeCase();
      const assignmentA = makeAssignment({
        id: 'assignment-a',
        action: 'acknowledge',
        target_user_id: 'user-1'
      });
      const assignmentB = makeAssignment({
        id: 'assignment-b',
        action: 'acknowledge',
        target_user_id: 'user-3'
      });
      const governance = makeGovernanceDouble(caseRow, assignmentA, [assignmentB]);
      const db = makeDb(governance);

      await decideGovernanceAssignment(
        db,
        'ws-1',
        assignmentA.id,
        { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent,
        { decision: 'acknowledge', idempotencyKey: 'key-1' },
        registryWithIndependentAck
      );

      const second = await decideGovernanceAssignment(
        db,
        'ws-1',
        assignmentB.id,
        { context: { user: { id: 'user-3' } } } as unknown as AuthenticatedEvent,
        { decision: 'acknowledge', idempotencyKey: 'key-2' },
        registryWithIndependentAck
      );

      expect(second.case.status).toBe('open');
    });
  });
});

describe('listMySubmittedGovernanceCases', () => {
  it('only returns cases initiated by the current user', async () => {
    const own = makeCase({ id: 'case-own', initiator_user_id: 'user-1' });
    const other = makeCase({ id: 'case-other', initiator_user_id: 'user-2' });
    const assignment = makeAssignment({ case_id: 'case-own' });
    const db = makeDb(makeGovernanceDouble(own, assignment, [], [other]));

    const result = await listMySubmittedGovernanceCases(db, 'ws-1', event, {});

    expect(result.map(s => s.case.id)).toEqual(['case-own']);
  });

  it('includes only still-open assignments as the waiting state', async () => {
    const caseRow = makeCase({ initiator_user_id: 'user-1' });
    const openAssignment = makeAssignment({ id: 'assignment-open', status: 'open' });
    const resolvedAssignment = makeAssignment({
      id: 'assignment-resolved',
      status: 'completed',
      resolved_at: now
    });
    const db = makeDb(makeGovernanceDouble(caseRow, openAssignment, [resolvedAssignment]));

    const [submission] = await listMySubmittedGovernanceCases(db, 'ws-1', event, {});

    expect(submission?.openAssignments.map(a => a.id)).toEqual(['assignment-open']);
  });

  it('filters by caseKind and status', async () => {
    const matching = makeCase({
      id: 'case-match',
      initiator_user_id: 'user-1',
      case_kind: 'entity.change',
      status: 'open'
    });
    const wrongKind = makeCase({
      id: 'case-wrong-kind',
      initiator_user_id: 'user-1',
      case_kind: 'test.echo',
      status: 'open'
    });
    const wrongStatus = makeCase({
      id: 'case-wrong-status',
      initiator_user_id: 'user-1',
      case_kind: 'entity.change',
      status: 'completed'
    });
    const assignment = makeAssignment({ case_id: 'case-match' });
    const db = makeDb(makeGovernanceDouble(matching, assignment, [], [wrongKind, wrongStatus]));

    const result = await listMySubmittedGovernanceCases(db, 'ws-1', event, {
      caseKind: 'entity.change',
      status: 'open'
    });

    expect(result.map(s => s.case.id)).toEqual(['case-match']);
  });

  it('returns cases the user initiated even when self-approval is not allowed', async () => {
    const caseRow = makeCase({ initiator_user_id: 'user-1', self_approval_allowed: false });
    const assignment = makeAssignment({ target_user_id: 'someone-else' });
    const db = makeDb(makeGovernanceDouble(caseRow, assignment));

    const result = await listMySubmittedGovernanceCases(db, 'ws-1', event, {});

    expect(result).toHaveLength(1);
  });
});
