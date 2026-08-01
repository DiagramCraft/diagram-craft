import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { toApiMember } from './changeCaseOperations';
import { requireNoRestrictedCaseMemberWrites } from './changeCaseOperations';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { ChangeCaseMemberDbResult } from './db/changeCaseDatabase';

const authCtxWithNoTeams = () =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    schemas: [],
    entities: [],
    grants: []
  });

const schema: FieldGroupSchemaShape = {
  fields: [
    { id: 'visible', name: 'Visible', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ]
};
const schemaById = new Map([['schema-1', schema as unknown as SchemaDbResult]]);

const member = {
  id: 'member-1',
  revision_id: 'revision-1',
  workspace: 'ws-1',
  entity_id: 'e1',
  base_version: 1,
  base_state: { schema_id: 'schema-1', data: { visible: 'v-before', secret: 'before' } },
  proposed_state: { schema_id: 'schema-1', data: { visible: 'v-after', secret: 'after' } },
  diff: {},
  applied_version_id: null
} as unknown as ChangeCaseMemberDbResult;

describe('toApiMember', () => {
  it('omits restricted field values from base_state and proposed_state for a caller without view access', () => {
    const api = toApiMember(member, authCtxWithNoTeams(), schemaById);
    expect(api.base_state['data']).toEqual({ visible: 'v-before' });
    expect(api.proposed_state['data']).toEqual({ visible: 'v-after' });
  });

  it('leaves data unchanged for a caller with view access', () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });
    const api = toApiMember(member, authCtx, schemaById);
    expect(api.base_state['data']).toEqual({ visible: 'v-before', secret: 'before' });
    expect(api.proposed_state['data']).toEqual({ visible: 'v-after', secret: 'after' });
  });

  it('is a no-op when the state has no matching schema', () => {
    const api = toApiMember(member, authCtxWithNoTeams(), new Map());
    expect(api.base_state['data']).toEqual({ visible: 'v-before', secret: 'before' });
    expect(api.proposed_state['data']).toEqual({ visible: 'v-after', secret: 'after' });
  });
});

describe('requireNoRestrictedCaseMemberWrites', () => {
  const entity = {
    schema_id: 'schema-1',
    data: { visible: 'before', secret: 'before' }
  } as never;
  const db = {
    catalog: {
      getSchema: vi.fn(async () => schema)
    }
  } as unknown as DatabaseAdapter;

  it('rejects a proposed change to a restricted field', async () => {
    await expect(
      requireNoRestrictedCaseMemberWrites(db, 'ws-1', authCtxWithNoTeams(), entity, {
        schema_id: 'schema-1',
        data: { visible: 'after', secret: 'changed' }
      })
    ).rejects.toThrow();
  });

  it('allows a proposed state that resubmits an unchanged restricted field', async () => {
    await expect(
      requireNoRestrictedCaseMemberWrites(db, 'ws-1', authCtxWithNoTeams(), entity, {
        schema_id: 'schema-1',
        data: { visible: 'after', secret: 'before' }
      })
    ).resolves.toBeUndefined();
  });

  it('allows a restricted change for a caller with edit access', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_editor' }],
      schemas: [],
      entities: [],
      grants: []
    });

    await expect(
      requireNoRestrictedCaseMemberWrites(db, 'ws-1', authCtx, entity, {
        schema_id: 'schema-1',
        data: { visible: 'before', secret: 'changed' }
      })
    ).resolves.toBeUndefined();
  });
});
