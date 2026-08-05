import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type {
  EntityChangeApprovalDbResult,
  EntityChangeApprovalRevisionDbResult
} from './db/entityChangeDatabase';
import {
  bypassRelationApproval,
  getRelationChangeApproval,
  submitRelationChangeApproval,
  withdrawRelationChangeApproval,
  createRelationGovernanceRegistry,
  RELATION_CHANGE_CASE_KIND
} from './relationChangeOperations';
import type {
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from '../governance/db/governanceDatabase';

const authorizationMocks = vi.hoisted(() => ({
  buildApiEntityAuthCtx: vi.fn()
}));

vi.mock('../auth/authorization', async () => ({
  ...(await vi.importActual<typeof import('../auth/authorization')>('../auth/authorization')),
  buildApiEntityAuthCtx: authorizationMocks.buildApiEntityAuthCtx
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const governanceMocks = vi.hoisted(() => ({
  createGovernanceCaseInTransaction: vi.fn(async () => ({ id: 'governance-case-1' })),
  recordGovernanceEvent: vi.fn(async () => {}),
  resolveAssignmentNotifications: vi.fn(async () => {}),
  resolveCaseNotifications: vi.fn(async () => {})
}));

vi.mock('../governance/governanceOperations', () => governanceMocks);

const entityChangeMocks = vi.hoisted(() => ({
  listEligibleApproverIds: vi.fn(async () => new Set(['user-1'])),
  isSoleApprover: vi.fn(() => true)
}));

vi.mock('./entityChangeOperations', async () => ({
  ...(await vi.importActual<typeof import('./entityChangeOperations')>('./entityChangeOperations')),
  listEligibleApproverIds: entityChangeMocks.listEligibleApproverIds,
  isSoleApprover: entityChangeMocks.isSoleApprover
}));

const now = new Date('2026-06-29T12:00:00.000Z');

const authCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'admin',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const event = { context: { user: { id: 'user-1', display_name: 'User' } } } as AuthenticatedEvent;
const eventForAuthCtx = () => {
  authorizationMocks.buildApiEntityAuthCtx.mockResolvedValueOnce(authCtx);
  return event;
};

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Depends On',
  description: '',
  in_schema_ids: [],
  out_schema_ids: [],
  fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' } as never],
  groups: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  created_at: now,
  updated_at: now
};

const makeRelation = (overrides: Partial<RelationDbResult> = {}): RelationDbResult => ({
  id: 'relation-1',
  workspace: 'ws-1',
  schema_id: relationSchema.id,
  schema_name: relationSchema.name,
  in_entity_id: 'entity-in',
  in_entity_name: 'In',
  out_entity_id: 'entity-out',
  out_entity_name: 'Out',
  data: { note: 'before' },
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeDb = (options: {
  relation?: RelationDbResult;
  schema?: RelationSchemaDbResult;
  openApproval?: EntityChangeApprovalDbResult | null;
  revision?: EntityChangeApprovalRevisionDbResult | null;
}) => {
  const relation = options.relation ?? makeRelation();
  const schema = options.schema ?? relationSchema;
  const createApproval = vi.fn(
    async (input: { id: string; entity_id: string }) =>
      ({
        id: input.id,
        workspace: 'ws-1',
        entity_id: input.entity_id,
        status: 'open' as const,
        initiator_user_id: 'user-1',
        created_at: now,
        updated_at: now,
        closed_at: null
      }) satisfies EntityChangeApprovalDbResult
  );
  const createApprovalRevision = vi.fn(async () => ({}));
  const listApprovalRevisions = vi.fn(async () => []);
  const updateApprovalRevisionStatus = vi.fn(async () => {});
  const updateApprovalStatus = vi.fn(async () => {});
  const cancelCaseIfOpen = vi.fn(async () => ({ id: 'governance-case-1' }));
  const supersedeAllOpenAssignmentsForCase = vi.fn(async () => []);

  const updateRelation = vi.fn(
    async (_ws: string, _id: string, input: Record<string, unknown>) => ({
      ...relation,
      ...input
    })
  );
  const createEntityVersion = vi.fn(async (input: Record<string, unknown>) => input);
  const getApprovalRevision = vi.fn(async () => options.revision ?? null);

  const db = {
    relation: {
      getRelation: vi.fn(async () => relation),
      getRelationSchema: vi.fn(async () => schema),
      listRelationSchemaVersions: vi.fn(async () => []),
      listRelations: vi.fn(async () => ({ items: [], total: 0 })),
      updateRelation
    },
    catalog: {
      getEntity: vi.fn(async () => null),
      listSchemas: vi.fn(async () => []),
      createEntityVersion
    },
    entityChange: {
      getOpenApproval: vi.fn(async () => options.openApproval ?? null),
      getApproval: vi.fn(async () => options.openApproval ?? null),
      createApproval,
      createApprovalRevision,
      getLatestApprovalRevision: vi.fn(async () => ({ id: 'revision-1', revision_number: 1 })),
      getApprovalRevision,
      listApprovalRevisions,
      updateApprovalRevisionStatus,
      updateApprovalStatus
    },
    governance: {
      listCases: vi.fn(async () => [{ id: 'governance-case-1', subject_version: 'revision-1' }]),
      cancelCaseIfOpen,
      supersedeAllOpenAssignmentsForCase
    },
    auth: {
      getUser: vi.fn(async () => null)
    },
    audit: {
      createAuditLog: vi.fn(async () => ({ id: 'audit-1' }))
    },
    watch: {
      listWatcherUserIds: vi.fn(async () => []),
      createNotificationsFromAudit: vi.fn(async () => {})
    },
    core: {
      transaction: vi.fn(async (fn: (tx: DatabaseAdapter) => unknown) => fn(db as never))
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    relation,
    createApproval,
    createApprovalRevision,
    updateRelation,
    createEntityVersion,
    updateApprovalRevisionStatus,
    updateApprovalStatus
  };
};

describe('getRelationChangeApproval', () => {
  it('returns null when the relation has no open proposal', async () => {
    const { db } = makeDb({ openApproval: null });

    const result = await getRelationChangeApproval(db, 'ws-1', 'relation-1', eventForAuthCtx());

    expect(result).toBeNull();
  });
});

describe('submitRelationChangeApproval', () => {
  it('rejects when the relation does not require approval', async () => {
    const { db } = makeDb({ schema: { ...relationSchema, relation_approval_policy: 'disabled' } });

    await expect(
      submitRelationChangeApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
        baseVersion: 1,
        proposedState: { data: { note: 'after' } }
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('creates an approval, a revision, and a governance case with subjectType relation', async () => {
    const requiredSchema = { ...relationSchema, relation_approval_policy: 'required' as const };
    const { db, createApproval, createApprovalRevision } = makeDb({ schema: requiredSchema });

    await submitRelationChangeApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
      baseVersion: 1,
      proposedState: { data: { note: 'after' } }
    });

    expect(createApproval).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'relation-1', status: 'open' })
    );
    expect(createApprovalRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'relation-1',
        base_version: 1,
        proposed_state: expect.objectContaining({ data: { note: 'after' } })
      })
    );
    expect(governanceMocks.createGovernanceCaseInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'ws-1',
      'user-1',
      expect.objectContaining({
        subjectType: 'relation',
        subjectId: 'relation-1'
      }),
      expect.any(Date)
    );
  });

  it('rejects when the proposed data has no actual change', async () => {
    const requiredSchema = { ...relationSchema, relation_approval_policy: 'required' as const };
    const { db } = makeDb({ schema: requiredSchema });

    await expect(
      submitRelationChangeApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
        baseVersion: 1,
        proposedState: { data: { note: 'before' } }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a proposal that changes a relation endpoint', async () => {
    const requiredSchema = { ...relationSchema, relation_approval_policy: 'required' as const };
    const { db } = makeDb({ schema: requiredSchema });

    await expect(
      submitRelationChangeApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
        baseVersion: 1,
        proposedState: { data: { note: 'after' }, in_entity_id: 'entity-other' }
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('withdrawRelationChangeApproval', () => {
  it('cancels the governance case and marks the proposal withdrawn', async () => {
    const openApproval: EntityChangeApprovalDbResult = {
      id: 'approval-1',
      workspace: 'ws-1',
      entity_id: 'relation-1',
      status: 'open',
      initiator_user_id: 'user-1',
      created_at: now,
      updated_at: now,
      closed_at: null
    };
    const { db } = makeDb({ openApproval });

    await withdrawRelationChangeApproval(
      db,
      'ws-1',
      'relation-1',
      'approval-1',
      eventForAuthCtx(),
      'no longer needed'
    );

    expect(db.governance.cancelCaseIfOpen).toHaveBeenCalledWith(
      'governance-case-1',
      expect.any(Date)
    );
    expect(db.entityChange.updateApprovalStatus).toHaveBeenCalledWith(
      'ws-1',
      'approval-1',
      'withdrawn',
      expect.any(Date),
      expect.any(Date)
    );
  });
});

describe('bypassRelationApproval', () => {
  it('writes the proposed data directly, versions it, and audits the bypass', async () => {
    const { db, updateRelation, createEntityVersion } = makeDb({});

    const result = await bypassRelationApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
      baseVersion: 1,
      proposedState: { data: { note: 'after' } },
      reason: 'urgent fix'
    });

    expect(result).toEqual({ relationId: 'relation-1', version: 2, bypassed: true });
    expect(updateRelation).toHaveBeenCalledWith(
      'ws-1',
      'relation-1',
      expect.objectContaining({ data: { note: 'after' }, version: 2 })
    );
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'relation-1', kind: 'autosave' })
    );
    expect(db.audit.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ approvalBypass: true, reason: 'urgent fix' })
      })
    );
  });

  it('rejects a bypass that changes a relation endpoint', async () => {
    const { db, updateRelation } = makeDb({});

    await expect(
      bypassRelationApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
        baseVersion: 1,
        proposedState: { data: { note: 'after' }, out_entity_id: 'entity-other' },
        reason: 'urgent fix'
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(updateRelation).not.toHaveBeenCalled();
  });

  it('rejects when the relation changed since baseVersion', async () => {
    const { db, updateRelation } = makeDb({});

    await expect(
      bypassRelationApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
        baseVersion: 99,
        proposedState: { data: { note: 'after' } },
        reason: 'urgent fix'
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(updateRelation).not.toHaveBeenCalled();
  });

  it('approves and cancels an open proposal that the bypass superseded', async () => {
    const openApproval: EntityChangeApprovalDbResult = {
      id: 'approval-1',
      workspace: 'ws-1',
      entity_id: 'relation-1',
      status: 'open',
      initiator_user_id: 'user-2',
      created_at: now,
      updated_at: now,
      closed_at: null
    };
    const { db, updateApprovalRevisionStatus, updateApprovalStatus } = makeDb({ openApproval });

    await bypassRelationApproval(db, 'ws-1', 'relation-1', eventForAuthCtx(), {
      baseVersion: 1,
      proposedState: { data: { note: 'after' } },
      reason: 'urgent fix'
    });

    expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
      'ws-1',
      'revision-1',
      'approved',
      expect.any(Date)
    );
    expect(updateApprovalStatus).toHaveBeenCalledWith(
      'ws-1',
      'approval-1',
      'approved',
      expect.any(Date),
      expect.any(Date)
    );
    expect(db.governance.cancelCaseIfOpen).toHaveBeenCalledWith(
      'governance-case-1',
      expect.any(Date)
    );
    expect(governanceMocks.recordGovernanceEvent).toHaveBeenCalledWith(
      db,
      { id: 'governance-case-1' },
      expect.objectContaining({ eventType: 'admin_override' })
    );
  });
});

describe('createRelationGovernanceRegistry', () => {
  const config = () => {
    const registry = createRelationGovernanceRegistry();
    const entry = registry.get(RELATION_CHANGE_CASE_KIND);
    if (!entry) throw new Error(`no config registered for ${RELATION_CHANGE_CASE_KIND}`);
    return entry;
  };

  const makeRevision = (
    overrides: Partial<EntityChangeApprovalRevisionDbResult> = {}
  ): EntityChangeApprovalRevisionDbResult => ({
    id: 'revision-1',
    proposal_id: 'approval-1',
    workspace: 'ws-1',
    entity_id: 'relation-1',
    revision_number: 1,
    base_version: 1,
    base_state: { schema_id: relationSchema.id, data: { note: 'before' } },
    proposed_state: { schema_id: relationSchema.id, data: { note: 'after' } },
    diff: { data: { before: { note: 'before' }, after: { note: 'after' } } },
    policy_version: 'v1',
    resolved_policy: {},
    message: null,
    created_by: 'user-1',
    status: 'submitted',
    created_at: now,
    resolved_at: null,
    ...overrides
  });

  const makeGovernanceCase = (
    overrides: Partial<GovernanceCaseDbResult> = {}
  ): GovernanceCaseDbResult => ({
    id: 'governance-case-1',
    workspace: 'ws-1',
    case_kind: RELATION_CHANGE_CASE_KIND,
    subject_type: 'relation',
    subject_id: 'relation-1',
    subject_version: 'revision-1',
    status: 'open',
    outcome: null,
    policy_version: 'v1',
    initiator_user_id: 'user-1',
    parent_case_id: null,
    self_approval_allowed: false,
    payload: { relationId: 'relation-1', proposalId: 'approval-1', revisionId: 'revision-1' },
    created_at: now,
    due_at: null,
    completed_at: null,
    cancelled_at: null,
    reminder_windows_sent: [],
    escalated_at: null,
    ...overrides
  });

  const makeGovernanceEvent = (
    overrides: Partial<GovernanceEventDbResult> = {}
  ): GovernanceEventDbResult => ({
    id: 'event-1',
    case_id: 'governance-case-1',
    workspace: 'ws-1',
    event_type: 'approved',
    actor_user_id: 'user-2',
    occurred_at: now,
    previous_status: 'open',
    resulting_status: 'open',
    reason: null,
    metadata: {},
    ...overrides
  });

  describe('subjectVisible', () => {
    it('returns false when the relation no longer exists', async () => {
      const { db } = makeDb({});
      db.relation.getRelation = vi.fn(async () => null);

      const visible = await config().subjectVisible!(db, authCtx, 'ws-1', 'relation-1');

      expect(visible).toBe(false);
    });

    it('returns true when the relation exists and is not field-restricted', async () => {
      const { db } = makeDb({});

      const visible = await config().subjectVisible!(db, authCtx, 'ws-1', 'relation-1');

      expect(visible).toBe(true);
    });
  });

  describe('beforeDecision', () => {
    it('proceeds for non-approve decisions without checking staleness', async () => {
      const { db } = makeDb({});
      const caseRow = makeGovernanceCase();

      const result = await config().beforeDecision!(db, {
        case: caseRow,
        assignmentId: 'assignment-1',
        actorUserId: 'user-2',
        decision: 'reject'
      });

      expect(result).toBe('proceed');
      expect(db.entityChange.getApprovalRevision).not.toHaveBeenCalled();
    });

    it('proceeds on approve when the relation has not changed since the revision was proposed', async () => {
      const { db } = makeDb({ revision: makeRevision() });
      const caseRow = makeGovernanceCase();

      const result = await config().beforeDecision!(db, {
        case: caseRow,
        assignmentId: 'assignment-1',
        actorUserId: 'user-2',
        decision: 'approve'
      });

      expect(result).toBe('proceed');
    });

    it('marks the revision stale on approve when the relation changed out from under it', async () => {
      const conflictingRelation = makeRelation({ data: { note: 'someone else changed this' } });
      const { db, updateApprovalRevisionStatus } = makeDb({
        relation: conflictingRelation,
        revision: makeRevision()
      });
      const caseRow = makeGovernanceCase();

      const result = await config().beforeDecision!(db, {
        case: caseRow,
        assignmentId: 'assignment-1',
        actorUserId: 'user-2',
        decision: 'approve'
      });

      expect(result).toBe('stale');
      expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
        'ws-1',
        'revision-1',
        'stale',
        expect.any(Date)
      );
    });
  });

  describe('handleDecision', () => {
    it('marks the revision changes_requested on request_changes', async () => {
      const { db, updateApprovalRevisionStatus } = makeDb({});
      const caseRow = makeGovernanceCase();

      await config().handleDecision!(db, {
        case: caseRow,
        event: makeGovernanceEvent(),
        decision: 'request_changes'
      });

      expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
        'ws-1',
        'revision-1',
        'changes_requested'
      );
    });

    it('marks the revision and proposal rejected on reject', async () => {
      const { db, updateApprovalRevisionStatus, updateApprovalStatus } = makeDb({});
      const caseRow = makeGovernanceCase();

      await config().handleDecision!(db, {
        case: caseRow,
        event: makeGovernanceEvent(),
        decision: 'reject'
      });

      expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
        'ws-1',
        'revision-1',
        'rejected',
        expect.any(Date)
      );
      expect(updateApprovalStatus).toHaveBeenCalledWith(
        'ws-1',
        'approval-1',
        'rejected',
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('applyDomainEffect', () => {
    it('applies the proposed data to the live relation, versions it, and marks the proposal approved', async () => {
      const {
        db,
        updateRelation,
        createEntityVersion,
        updateApprovalRevisionStatus,
        updateApprovalStatus
      } = makeDb({ revision: makeRevision() });
      const caseRow = makeGovernanceCase();
      const event = makeGovernanceEvent();

      await config().applyDomainEffect!(db, { case: caseRow, event });

      expect(updateRelation).toHaveBeenCalledWith(
        'ws-1',
        'relation-1',
        expect.objectContaining({ data: { note: 'after' }, version: 2 })
      );
      expect(createEntityVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_id: 'relation-1',
          kind: 'case_applied',
          applied_case_revision_id: 'revision-1'
        })
      );
      expect(updateApprovalRevisionStatus).toHaveBeenCalledWith(
        'ws-1',
        'revision-1',
        'approved',
        expect.any(Date)
      );
      expect(updateApprovalStatus).toHaveBeenCalledWith(
        'ws-1',
        'approval-1',
        'approved',
        expect.any(Date),
        expect.any(Date)
      );
      expect(governanceMocks.recordGovernanceEvent).toHaveBeenCalledWith(
        db,
        caseRow,
        expect.objectContaining({ eventType: 'domain_effect_applied' })
      );
    });

    it('rejects when the relation changed in a field the proposal also touched', async () => {
      const conflictingRelation = makeRelation({ data: { note: 'someone else changed this' } });
      const { db } = makeDb({ relation: conflictingRelation, revision: makeRevision() });
      const caseRow = makeGovernanceCase();
      const event = makeGovernanceEvent();

      await expect(config().applyDomainEffect!(db, { case: caseRow, event })).rejects.toMatchObject(
        {
          status: 409
        }
      );
    });

    it('rejects when the proposal revision no longer exists', async () => {
      const { db } = makeDb({ revision: null });
      const caseRow = makeGovernanceCase();
      const event = makeGovernanceEvent();

      await expect(config().applyDomainEffect!(db, { case: caseRow, event })).rejects.toMatchObject(
        {
          status: 409
        }
      );
    });
  });
});
