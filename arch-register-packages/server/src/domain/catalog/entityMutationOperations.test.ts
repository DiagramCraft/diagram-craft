import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { updateEntity } from './entityMutationOperations';

const now = new Date('2026-06-29T12:00:00.000Z');

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [
    { id: 'name_field', name: 'Name field', requirementLevel: null, type: 'text' } as never,
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    } as never
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-owner'] } }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const baseEntity = (data: Record<string, unknown>): EntityDbResult => ({
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'SRV-1',
  slug: 'my-entity',
  namespace: 'default',
  name: 'My Entity',
  description: '',
  owner: 'team-owner',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data,
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  completeness: 0
});

const makeDb = (entity: EntityDbResult) =>
  ({
    catalog: {
      getEntity: vi.fn(async () => entity),
      getSchema: vi.fn(async () => schema),
      listEntitiesPaginated: vi.fn(async () => []),
      updateEntity: vi.fn(async (_ws: string, _id: string, input: Record<string, unknown>) => ({
        ...entity,
        ...input
      })),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    },
    workspace: {
      listLifecycleStates: vi.fn(async () => []),
      listTeams: vi.fn(async () => [{ id: 'team-owner' }])
    },
    audit: {
      createAuditLog: vi.fn(async () => ({ id: 'audit-1' }))
    },
    watch: {
      listWatcherUserIds: vi.fn(async () => []),
      createNotificationsFromAudit: vi.fn(async () => {})
    }
  }) as unknown as DatabaseAdapter;

// Workspace role 'editor' grants general edit_entity access without the 'people.role'
// capability that would otherwise bypass field-group restriction (see admin bypass test below).
const authCtxWithTeamRole = (role: 'team_reviewer' | 'team_editor' | 'team_admin' | null) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: 'editor',
    teamAssignments: role ? [{ teamId: 'team-owner', role }] : [],
    schemas: [],
    entities: [],
    grants: []
  });

const updatePayload = (fields: Record<string, unknown>) => ({
  _schemaId: 'schema-1',
  _name: 'My Entity',
  _slug: 'my-entity',
  _owner: 'team-owner',
  ...fields
});

describe('updateEntity — restricted field group writes', () => {
  it('rejects a write that changes a field in a group the caller cannot edit', async () => {
    const db = makeDb(baseEntity({ name_field: 'x', secret: 'original' }));
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        updatePayload({ name_field: 'x', secret: 'changed' }),
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();

    expect(db.catalog.updateEntity).not.toHaveBeenCalled();
  });

  it('allows a write that resubmits an unchanged restricted value verbatim', async () => {
    const db = makeDb(baseEntity({ name_field: 'x', secret: 'original' }));
    const authCtx = authCtxWithTeamRole(null);

    const result = await updateEntity(
      db,
      'ws-1',
      'entity-1',
      updatePayload({ name_field: 'y', secret: 'original' }),
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    expect(result.name_field).toBe('y');
    expect(db.catalog.updateEntity).toHaveBeenCalled();
  });

  it('allows a write that changes a restricted field when the caller has team_editor access', async () => {
    const db = makeDb(baseEntity({ name_field: 'x', secret: 'original' }));
    const authCtx = authCtxWithTeamRole('team_editor');

    const result = await updateEntity(
      db,
      'ws-1',
      'entity-1',
      updatePayload({ name_field: 'x', secret: 'changed' }),
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    expect(result.secret).toBe('changed');
    expect(db.catalog.updateEntity).toHaveBeenCalled();
  });

  it('rejects a write that changes a restricted field when the caller only has team_reviewer (view) access', async () => {
    const db = makeDb(baseEntity({ name_field: 'x', secret: 'original' }));
    const authCtx = authCtxWithTeamRole('team_reviewer');

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        updatePayload({ name_field: 'x', secret: 'changed' }),
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();
  });

  it('allows a workspace admin to change a restricted field with no team membership', async () => {
    const db = makeDb(baseEntity({ name_field: 'x', secret: 'original' }));
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'admin',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const result = await updateEntity(
      db,
      'ws-1',
      'entity-1',
      updatePayload({ name_field: 'x', secret: 'changed' }),
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    expect(result.secret).toBe('changed');
    expect(db.catalog.updateEntity).toHaveBeenCalled();
  });
});
