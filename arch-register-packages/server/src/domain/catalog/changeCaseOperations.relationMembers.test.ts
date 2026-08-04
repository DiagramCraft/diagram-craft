import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { ChangeCaseDbResult, ChangeCaseMemberDbResult } from './db/changeCaseDatabase';
import { addRelationToChangeCase, applyChangeCase } from './changeCaseOperations';

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

vi.mock('../audit/db/auditLogging', async () => ({
  ...(await vi.importActual<typeof import('../audit/db/auditLogging')>('../audit/db/auditLogging')),
  logAudit: vi.fn(async () => {})
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

const project = {
  id: 'project-1',
  workspace: 'ws-1',
  name: 'Project',
  owner: null,
  status: 'active',
  color: null,
  target_date: null,
  pinned: false,
  owner_name: null,
  created_at: now,
  updated_at: now
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

const changeCase: ChangeCaseDbResult = {
  id: 'case-1',
  workspace: 'ws-1',
  project_id: project.id,
  status: 'planned',
  purpose: 'planned_change',
  name: 'Case',
  description: null,
  effective_date: null,
  milestone_id: null,
  initiator_user_id: null,
  created_at: now,
  updated_at: now,
  closed_at: null
};

const revision = {
  id: 'revision-1',
  case_id: changeCase.id,
  workspace: 'ws-1',
  revision_number: 1,
  message: null,
  created_by: null,
  status: 'draft' as const,
  is_active: true,
  created_at: now,
  resolved_at: null
};

const makeMember = (overrides: Partial<ChangeCaseMemberDbResult> = {}): ChangeCaseMemberDbResult => ({
  id: 'member-1',
  revision_id: revision.id,
  workspace: 'ws-1',
  entity_id: 'relation-1',
  base_version: 1,
  base_state: { id: 'relation-1', schema_id: relationSchema.id, data: { note: 'before' } },
  proposed_state: { id: 'relation-1', schema_id: relationSchema.id, data: { note: 'after' } },
  diff: {},
  applied_version_id: null,
  ...overrides
});

const makeDb = (options: {
  relation?: RelationDbResult;
  members?: ChangeCaseMemberDbResult[];
}) => {
  const relation = options.relation ?? makeRelation();
  const members = options.members ?? [];
  const addMember = vi.fn(async () => {});
  const updateRelation = vi.fn(
    async (_ws: string, _id: string, input: { data: Record<string, unknown>; version: number }) => ({
      ...relation,
      data: input.data,
      version: input.version
    })
  );
  const createEntityVersion = vi.fn(async () => ({}));
  const markMemberApplied = vi.fn(async () => {});
  const markRevisionApplied = vi.fn(async () => {});
  const markCaseApplied = vi.fn(async () => {});

  const db = {
    project: {
      getProject: vi.fn(async () => project)
    },
    changeCase: {
      getCase: vi.fn(async () => changeCase),
      getActiveRevision: vi.fn(async () => revision),
      getLatestRevision: vi.fn(async () => revision),
      listMembers: vi.fn(async () => members),
      addMember,
      markMemberApplied,
      markRevisionApplied,
      markCaseApplied
    },
    catalog: {
      // No entity has id 'relation-1' — getCaseMemberSubject falls through to db.relation.getRelation.
      getEntity: vi.fn(async () => null),
      getSchema: vi.fn(async () => null),
      listSchemaVersions: vi.fn(async () => []),
      listSchemas: vi.fn(async () => []),
      createEntityVersion
    },
    relation: {
      getRelation: vi.fn(async () => relation),
      getRelationSchema: vi.fn(async () => relationSchema),
      listRelationSchemaVersions: vi.fn(async () => []),
      updateRelation
    },
    core: {
      transaction: vi.fn(async (fn: (tx: DatabaseAdapter) => unknown) => fn(db as never))
    }
  } as unknown as DatabaseAdapter;

  return { db, relation, addMember, updateRelation, createEntityVersion, markMemberApplied };
};

describe('addRelationToChangeCase', () => {
  it('adds a relation instance as a change case member with a relation-shaped base_state', async () => {
    const { db, relation, addMember } = makeDb({});

    await addRelationToChangeCase(
      db,
      'ws-1',
      project.id,
      changeCase.id,
      eventForAuthCtx(),
      { relationId: relation.id, proposedState: { data: { note: 'after' } } }
    );

    expect(addMember).toHaveBeenCalledWith(
      'ws-1',
      revision.id,
      expect.objectContaining({
        entity_id: relation.id,
        base_version: relation.version,
        base_state: expect.objectContaining({
          in_entity_id: relation.in_entity_id,
          out_entity_id: relation.out_entity_id,
          data: relation.data
        }),
        proposed_state: { data: { note: 'after' } }
      })
    );
  });

  it('rejects adding a relation that is already a member', async () => {
    const existingRelation = makeRelation();
    const { db } = makeDb({
      relation: existingRelation,
      members: [makeMember({ entity_id: existingRelation.id })]
    });

    await expect(
      addRelationToChangeCase(db, 'ws-1', project.id, changeCase.id, eventForAuthCtx(), {
        relationId: existingRelation.id,
        proposedState: { data: {} }
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a proposed state that changes a relation endpoint', async () => {
    const { db, relation, addMember } = makeDb({});

    await expect(
      addRelationToChangeCase(db, 'ws-1', project.id, changeCase.id, eventForAuthCtx(), {
        relationId: relation.id,
        proposedState: { data: { note: 'after' }, in_entity_id: 'entity-other' }
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(addMember).not.toHaveBeenCalled();
  });
});

describe('applyChangeCase — relation members', () => {
  it('applies a relation member: updates the relation, writes a case_applied record_version, and marks the member applied', async () => {
    const member = makeMember();
    const { db, updateRelation, createEntityVersion, markMemberApplied } = makeDb({
      members: [member]
    });

    const result = await applyChangeCase(db, 'ws-1', project.id, changeCase.id, eventForAuthCtx(), {
      resolutions: [{ memberId: member.id, resolvedEntityData: { data: { note: 'after' } } }]
    });

    expect(result.status).toBe(changeCase.status);
    expect(updateRelation).toHaveBeenCalledWith(
      'ws-1',
      'relation-1',
      expect.objectContaining({ data: { note: 'after' }, version: 2 })
    );
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'relation-1',
        kind: 'case_applied',
        version_number: 2,
        applied_case_revision_id: revision.id,
        state: expect.objectContaining({ data: { note: 'after' } })
      })
    );
    expect(markMemberApplied).toHaveBeenCalledWith('ws-1', member.id, expect.any(String));
  });

  it('rejects applying when the relation changed since the case was planned (stale base_version)', async () => {
    const member = makeMember({ base_version: 1 });
    const { db } = makeDb({
      relation: makeRelation({ version: 2 }),
      members: [member]
    });

    await expect(
      applyChangeCase(db, 'ws-1', project.id, changeCase.id, eventForAuthCtx(), {
        resolutions: [{ memberId: member.id, resolvedEntityData: { data: { note: 'after' } } }]
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});
