import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { updateEntity, createEntity, bulkCreateEntities } from './entityMutationOperations';

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

const makeDb = (entity: EntityDbResult) => {
  const db = {
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
    },
    core: {
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db))
    }
  } as unknown as DatabaseAdapter;
  return db;
};

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

const typedRelationSchema: SchemaDbResult = {
  ...schema,
  fields: [
    ...schema.fields,
    {
      id: 'deps',
      name: 'Depends on',
      requirementLevel: null,
      type: 'typedRelation',
      relationSchemaId: 'rel-schema-1',
      direction: 'out',
      minCount: 0,
      maxCount: 1,
      groupId: 'restricted'
    } as never
  ]
};

const makeTypedRelationDb = (entity: EntityDbResult) => {
  const relationRows = new Map<string, Record<string, unknown>>();
  const entitiesById = new Map<string, EntityDbResult>([
    [entity.id, entity],
    ['entity-2', { ...entity, id: 'entity-2', schema_id: 'schema-2' }]
  ]);
  const db = {
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) => entitiesById.get(id) ?? null),
      getSchema: vi.fn(async () => typedRelationSchema),
      listEntitiesPaginated: vi.fn(async () => []),
      updateEntity: vi.fn(async (_ws: string, _id: string, input: Record<string, unknown>) => ({
        ...entity,
        ...input
      })),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    },
    relation: {
      getRelationSchema: vi.fn(async () => ({
        id: 'rel-schema-1',
        workspace: 'ws-1',
        name: 'Dependency',
        description: '',
        in_schema_ids: ['schema-2'],
        out_schema_ids: ['schema-1'],
        fields: [],
        groups: [],
        created_at: now,
        updated_at: now
      })),
      createRelation: vi.fn(async (input: Record<string, unknown>) => {
        const row = {
          ...input,
          schema_name: 'Dependency',
          in_entity_name: 'Other',
          out_entity_name: 'My Entity',
          version: 1
        };
        relationRows.set(input.id as string, row);
        return row;
      }),
      getRelation: vi.fn(async (_ws: string, id: string) => relationRows.get(id) ?? null),
      listRelationsForEntity: vi.fn(async (_ws: string, entityId: string) => {
        const rows = [...relationRows.values()];
        return {
          outgoing: rows.filter(row => row.in_entity_id === entityId),
          incoming: rows.filter(row => row.out_entity_id === entityId)
        };
      }),
      updateRelation: vi.fn(async (_ws: string, id: string, input: Record<string, unknown>) => {
        const existing = relationRows.get(id);
        const row = { ...existing, ...input };
        relationRows.set(id, row);
        return row;
      }),
      deleteRelation: vi.fn(async (_ws: string, id: string) => {
        const existing = relationRows.get(id) ?? null;
        relationRows.delete(id);
        return existing;
      })
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
    },
    core: {
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db))
    }
  } as unknown as DatabaseAdapter;
  return db;
};

describe('updateEntity — typed relation deltas', () => {
  it('creates a relation instance atomically alongside the entity field update', async () => {
    const db = makeTypedRelationDb(baseEntity({ name_field: 'x' }));
    const authCtx = authCtxWithTeamRole('team_editor');

    const result = await updateEntity(
      db,
      'ws-1',
      'entity-1',
      {
        ...updatePayload({ name_field: 'y' }),
        _relations: {
          deps: { create: [{ otherEntityId: 'entity-2', data: {} }] }
        }
      },
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    expect(result.name_field).toBe('y');
    expect(db.relation.createRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_id: 'rel-schema-1',
        in_entity_id: 'entity-2',
        out_entity_id: 'entity-1'
      })
    );
    expect(db.catalog.updateEntity).toHaveBeenCalled();
  });

  it('rolls back the whole mutation when a relation delta fails endpoint validation', async () => {
    const db = makeTypedRelationDb(baseEntity({ name_field: 'x' }));
    const authCtx = authCtxWithTeamRole('team_editor');

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        {
          ...updatePayload({ name_field: 'y' }),
          _relations: {
            // 'entity-1' is not a valid "in" endpoint for rel-schema-1 (in_schema_ids: ['schema-2'])
            deps: { create: [{ otherEntityId: 'entity-1', data: {} }] }
          }
        },
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();

    expect(db.relation.createRelation).not.toHaveBeenCalled();
    expect(db.catalog.updateEntity).not.toHaveBeenCalled();
  });

  it('rejects a delta keyed by a field id that is not a typedRelation field', async () => {
    const db = makeTypedRelationDb(baseEntity({ name_field: 'x' }));
    const authCtx = authCtxWithTeamRole('team_editor');

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        {
          ...updatePayload({ name_field: 'y' }),
          _relations: {
            name_field: { create: [{ otherEntityId: 'entity-2', data: {} }] }
          }
        },
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();

    expect(db.catalog.updateEntity).not.toHaveBeenCalled();
  });

  it('enforces the typed relation maximum against the projected endpoint count', async () => {
    const db = makeTypedRelationDb(baseEntity({ name_field: 'x' }));
    const authCtx = authCtxWithTeamRole('team_editor');
    const relationDelta = {
      deps: { create: [{ otherEntityId: 'entity-2', data: {} }] }
    };

    await updateEntity(
      db,
      'ws-1',
      'entity-1',
      { ...updatePayload({ name_field: 'first' }), _relations: relationDelta },
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        { ...updatePayload({ name_field: 'second' }), _relations: relationDelta },
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow('allows at most 1 relation');

    expect(db.relation.createRelation).toHaveBeenCalledTimes(1);
    expect(db.catalog.updateEntity).toHaveBeenCalledTimes(1);
  });

  it('rejects a relation delta when the field is in an entity-schema group the caller cannot edit, even though the relation schema itself is unrestricted', async () => {
    const db = makeTypedRelationDb(baseEntity({ name_field: 'x' }));
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      updateEntity(
        db,
        'ws-1',
        'entity-1',
        {
          ...updatePayload({ name_field: 'x' }),
          _relations: {
            deps: { create: [{ otherEntityId: 'entity-2', data: {} }] }
          }
        },
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();

    expect(db.relation.createRelation).not.toHaveBeenCalled();
    expect(db.catalog.updateEntity).not.toHaveBeenCalled();
  });
});

const makeCreateDb = () => {
  const created: Record<string, unknown>[] = [];
  const db = {
    catalog: {
      getSchema: vi.fn(async () => schema),
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated: vi.fn(async () => []),
      createEntity: vi.fn(async (input: Record<string, unknown>) => {
        created.push(input);
        return { ...input, owner_name: null, schema_name: 'Service' };
      }),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    },
    workspace: {
      allocatePublicId: vi.fn(async () => 1),
      listLifecycleStates: vi.fn(async () => []),
      listTeams: vi.fn(async () => [{ id: 'team-owner' }])
    },
    audit: {
      createAuditLog: vi.fn(async () => ({ id: 'audit-1' }))
    },
    watch: {
      listWatcherUserIds: vi.fn(async () => []),
      createNotificationsFromAudit: vi.fn(async () => {})
    },
    core: {
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db))
    }
  } as unknown as DatabaseAdapter;
  return { db, created };
};

describe('createEntity — restricted field group writes', () => {
  it('rejects creating an entity with a value in a group the caller cannot edit', async () => {
    const { db } = makeCreateDb();
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      createEntity(db, 'ws-1', updatePayload({ name_field: 'x', secret: 'sneaked-in' }), authCtx, {
        id: 'user-1',
        displayName: 'User'
      })
    ).rejects.toThrow();
  });

  it('allows creating an entity with a restricted value when the caller has team_editor access', async () => {
    const { db, created } = makeCreateDb();
    const authCtx = authCtxWithTeamRole('team_editor');

    await createEntity(db, 'ws-1', updatePayload({ name_field: 'x', secret: 'allowed' }), authCtx, {
      id: 'user-1',
      displayName: 'User'
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.data).toMatchObject({ secret: 'allowed' });
  });
});

describe('bulkCreateEntities — restricted field group writes', () => {
  it('rejects bulk-creating an entity with a value in a group the caller cannot edit', async () => {
    const { db } = makeCreateDb();
    const authCtx = authCtxWithTeamRole(null);

    await expect(
      bulkCreateEntities(
        db,
        'ws-1',
        [updatePayload({ name_field: 'x', secret: 'sneaked-in' })],
        authCtx,
        { id: 'user-1', displayName: 'User' }
      )
    ).rejects.toThrow();
  });

  it('allows bulk-creating an entity with a restricted value when the caller has team_editor access', async () => {
    const { db, created } = makeCreateDb();
    const authCtx = authCtxWithTeamRole('team_editor');

    await bulkCreateEntities(
      db,
      'ws-1',
      [updatePayload({ name_field: 'x', secret: 'allowed' })],
      authCtx,
      { id: 'user-1', displayName: 'User' }
    );

    expect(created).toHaveLength(1);
    expect(created[0]?.data).toMatchObject({ secret: 'allowed' });
  });
});
