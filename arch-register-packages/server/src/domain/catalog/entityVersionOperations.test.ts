import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { redactVersionState } from './entityVersionOperations';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import type { EntityVersionDbResult } from './db/catalogDatabase';

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

const version: EntityVersionDbResult = {
  id: 'v1',
  workspace: 'ws-1',
  entity_id: 'e1',
  version_number: 1,
  kind: 'autosave',
  commit_message: null,
  created_at: new Date('2026-07-30T12:00:00.000Z'),
  created_by: null,
  created_by_name: null,
  state: { name: 'Entity', data: { visible: 'x', secret: 'y' } },
  applied_case_revision_id: null
};

describe('redactVersionState', () => {
  it('omits restricted field values from state.data for a caller without view access', () => {
    const redacted = redactVersionState(version, authCtxWithNoTeams(), schema);
    expect(redacted.state.data).toEqual({ visible: 'x' });
  });

  it('leaves state.data unchanged when the caller has view access', () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });
    const redacted = redactVersionState(version, authCtx, schema);
    expect(redacted.state.data).toEqual({ visible: 'x', secret: 'y' });
  });

  it('is a no-op when schema is null', () => {
    const redacted = redactVersionState(version, authCtxWithNoTeams(), null);
    expect(redacted.state.data).toEqual({ visible: 'x', secret: 'y' });
  });

  it('is a no-op when state has no data object', () => {
    const noDataVersion = { ...version, state: { name: 'Entity' } };
    const redacted = redactVersionState(noDataVersion, authCtxWithNoTeams(), schema);
    expect(redacted).toBe(noDataVersion);
  });
});
