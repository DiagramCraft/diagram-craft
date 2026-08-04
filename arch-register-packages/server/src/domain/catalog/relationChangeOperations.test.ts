import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { EntityChangeApprovalDbResult } from './db/entityChangeDatabase';
import {
  getRelationChangeApproval,
  submitRelationChangeApproval,
  withdrawRelationChangeApproval
} from './relationChangeOperations';

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

  const db = {
    relation: {
      getRelation: vi.fn(async () => relation),
      getRelationSchema: vi.fn(async () => schema),
      listRelationSchemaVersions: vi.fn(async () => []),
      listRelations: vi.fn(async () => ({ items: [], total: 0 }))
    },
    catalog: {
      getEntity: vi.fn(async () => null),
      listSchemas: vi.fn(async () => [])
    },
    entityChange: {
      getOpenApproval: vi.fn(async () => options.openApproval ?? null),
      getApproval: vi.fn(async () => options.openApproval ?? null),
      createApproval,
      createApprovalRevision,
      getLatestApprovalRevision: vi.fn(async () => ({ id: 'revision-1', revision_number: 1 })),
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
    core: {
      transaction: vi.fn(async (fn: (tx: DatabaseAdapter) => unknown) => fn(db as never))
    }
  } as unknown as DatabaseAdapter;

  return { db, relation, createApproval, createApprovalRevision };
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

    expect(db.governance.cancelCaseIfOpen).toHaveBeenCalledWith('governance-case-1', expect.any(Date));
    expect(db.entityChange.updateApprovalStatus).toHaveBeenCalledWith(
      'ws-1',
      'approval-1',
      'withdrawn',
      expect.any(Date),
      expect.any(Date)
    );
  });
});
