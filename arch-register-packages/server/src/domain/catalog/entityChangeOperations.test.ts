import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { toApiApprovalRevision, toApiBulkApprovalRevision } from './entityChangeOperations';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import type { SchemaDbResult } from './db/catalogDatabase';
import type {
  EntityChangeApprovalRevisionDbResult,
  EntityChangeApprovalRevisionMemberDbResult
} from './db/entityChangeDatabase';

const authCtxWithNoTeams = () =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    schemas: [],
    entities: [],
    grants: []
  });

const authCtxWithRestrictedTeam = () =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
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

const revision = {
  id: 'revision-1',
  proposal_id: 'proposal-1',
  workspace: 'ws-1',
  entity_id: 'e1',
  revision_number: 1,
  base_version: 1,
  base_state: { schema_id: 'schema-1', data: { visible: 'v-before', secret: 'before' } },
  proposed_state: { schema_id: 'schema-1', data: { visible: 'v-after', secret: 'after' } },
  diff: {
    data: {
      before: { visible: 'v-before', secret: 'before' },
      after: { visible: 'v-after', secret: 'after' }
    }
  },
  policy_version: 'schema-1:1:inherit',
  resolved_policy: {},
  message: null,
  created_by: 'user-1',
  status: 'submitted',
  created_at: new Date('2026-01-01'),
  resolved_at: null
} as unknown as EntityChangeApprovalRevisionDbResult;

describe('toApiApprovalRevision', () => {
  it('omits restricted field values from base/proposed state and diff for a caller without view access', () => {
    const api = toApiApprovalRevision(revision, null, null, authCtxWithNoTeams(), schemaById);
    expect(api.baseState['data']).toEqual({ visible: 'v-before' });
    expect(api.proposedState['data']).toEqual({ visible: 'v-after' });
    expect(api.diff['data']).toEqual({
      before: { visible: 'v-before' },
      after: { visible: 'v-after' }
    });
  });

  it('leaves state and diff unchanged for a caller with view access', () => {
    const api = toApiApprovalRevision(
      revision,
      null,
      null,
      authCtxWithRestrictedTeam(),
      schemaById
    );
    expect(api.baseState['data']).toEqual({ visible: 'v-before', secret: 'before' });
    expect(api.proposedState['data']).toEqual({ visible: 'v-after', secret: 'after' });
    expect(api.diff['data']).toEqual({
      before: { visible: 'v-before', secret: 'before' },
      after: { visible: 'v-after', secret: 'after' }
    });
  });

  it('is a no-op when the state has no matching schema', () => {
    const api = toApiApprovalRevision(revision, null, null, authCtxWithNoTeams(), new Map());
    expect(api.baseState['data']).toEqual({ visible: 'v-before', secret: 'before' });
    expect(api.proposedState['data']).toEqual({ visible: 'v-after', secret: 'after' });
  });
});

describe('toApiBulkApprovalRevision', () => {
  const otherSchema: FieldGroupSchemaShape = {
    fields: [
      { id: 'other-visible', name: 'Other Visible', requirementLevel: null, type: 'text' } as never
    ],
    groups: []
  };
  const bulkSchemaById = new Map([
    ['schema-1', schema as unknown as SchemaDbResult],
    ['schema-2', otherSchema as unknown as SchemaDbResult]
  ]);

  const members = [
    {
      ...revision,
      member_id: 'member-1',
      entity_id: 'e1'
    },
    {
      ...revision,
      member_id: 'member-2',
      entity_id: 'e2',
      base_state: { schema_id: 'schema-2', data: { 'other-visible': 'o-before' } },
      proposed_state: { schema_id: 'schema-2', data: { 'other-visible': 'o-after' } },
      diff: {}
    }
  ] as unknown as EntityChangeApprovalRevisionMemberDbResult[];

  it('omits restricted field values only for the member whose schema restricts them', () => {
    const api = toApiBulkApprovalRevision(
      members,
      null,
      null,
      authCtxWithNoTeams(),
      bulkSchemaById
    );
    expect(api.members[0]!.baseState['data']).toEqual({ visible: 'v-before' });
    expect(api.members[0]!.proposedState['data']).toEqual({ visible: 'v-after' });
    expect(api.members[1]!.baseState['data']).toEqual({ 'other-visible': 'o-before' });
    expect(api.members[1]!.proposedState['data']).toEqual({ 'other-visible': 'o-after' });
  });

  it('leaves state unchanged for a caller with view access', () => {
    const api = toApiBulkApprovalRevision(
      members,
      null,
      null,
      authCtxWithRestrictedTeam(),
      bulkSchemaById
    );
    expect(api.members[0]!.baseState['data']).toEqual({ visible: 'v-before', secret: 'before' });
  });
});
