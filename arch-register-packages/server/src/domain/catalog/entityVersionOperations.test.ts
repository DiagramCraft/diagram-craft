import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import {
  assertVersionDataCanBeRestored,
  changedVersionDataFieldIds,
  redactVersionState
} from './entityVersionOperations';
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

  it('fails closed when a historical schema is required but unavailable', () => {
    const redacted = redactVersionState(version, authCtxWithNoTeams(), schema, null, {
      failClosedWhenHistoricalSchemaMissing: true
    });
    expect(redacted.state.data).toEqual({});
  });

  it('is a no-op when state has no data object', () => {
    const noDataVersion = { ...version, state: { name: 'Entity' } };
    const redacted = redactVersionState(noDataVersion, authCtxWithNoTeams(), schema);
    expect(redacted).toBe(noDataVersion);
  });

  it('redacts historical-only fields using the historical schema', () => {
    const historicalSchema: FieldGroupSchemaShape = {
      fields: [
        {
          id: 'removed_secret',
          name: 'Removed secret',
          requirementLevel: null,
          type: 'text',
          groupId: 'restricted'
        } as never
      ],
      groups: schema.groups
    };
    const historicalVersion = {
      ...version,
      state: { ...version.state, data: { removed_secret: 'old-secret' } }
    };

    expect(
      redactVersionState(historicalVersion, authCtxWithNoTeams(), schema, historicalSchema).state
        .data
    ).toEqual({});
  });

  it('keeps historically restricted fields redacted after a current ACL relaxation', () => {
    const currentSchema: FieldGroupSchemaShape = {
      fields: [{ ...schema.fields[1]!, groupId: undefined }],
      groups: []
    };
    const historicalSchema: FieldGroupSchemaShape = {
      fields: schema.fields,
      groups: schema.groups
    };

    expect(
      redactVersionState(version, authCtxWithNoTeams(), currentSchema, historicalSchema).state.data
    ).toEqual({ visible: 'x' });
  });

  it('omits fields unknown to both schemas for authenticated callers', () => {
    const unknownVersion = {
      ...version,
      state: { ...version.state, data: { unknown: 'secret' } }
    };

    expect(redactVersionState(unknownVersion, authCtxWithNoTeams(), schema).state.data).toEqual({});
  });
});

describe('changedVersionDataFieldIds', () => {
  it('includes added, removed, and changed values', () => {
    expect(
      changedVersionDataFieldIds(
        { unchanged: 'same', changed: 'before', removed: 'value' },
        { unchanged: 'same', changed: 'after', added: 'value' }
      )
    ).toEqual(expect.arrayContaining(['changed', 'removed', 'added']));
  });
});

describe('assertVersionDataCanBeRestored', () => {
  it('rejects a changed restricted field without edit access', () => {
    expect(() =>
      assertVersionDataCanBeRestored(
        authCtxWithNoTeams(),
        schema,
        null,
        { secret: 'current' },
        { secret: 'historical' }
      )
    ).toThrow();
  });

  it('rejects changed fields unknown to current and historical schemas', () => {
    expect(() =>
      assertVersionDataCanBeRestored(
        authCtxWithNoTeams(),
        schema,
        null,
        {},
        { obsolete_secret: 'historical' }
      )
    ).toThrow();
  });

  it('allows unchanged restricted fields for a view-only caller', () => {
    const viewer = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(() =>
      assertVersionDataCanBeRestored(viewer, schema, null, { secret: 'same' }, { secret: 'same' })
    ).not.toThrow();
  });

  it('rejects restores when the historical schema is unavailable in fail-closed mode', () => {
    expect(() =>
      assertVersionDataCanBeRestored(
        authCtxWithNoTeams(),
        schema,
        null,
        { visible: 'same' },
        { visible: 'same' },
        { failClosedWhenHistoricalSchemaMissing: true }
      )
    ).toThrow();
  });
});
