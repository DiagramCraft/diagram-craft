import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import {
  createWorkspaceRelation,
  updateWorkspaceRelation,
  deleteWorkspaceRelation,
  listWorkspaceRelations,
  getWorkspaceRelation,
  restoreWorkspaceRelationVersion,
  queryWorkspaceRelations
} from './relationOperations';
import type { EntityVersionDbResult, EntityVersionSummaryDbResult } from './db/catalogDatabase';

const authorizationMocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn()
}));

vi.mock('../auth/authorization', async () => ({
  ...(await vi.importActual<typeof import('../auth/authorization')>('../auth/authorization')),
  buildApiAuthCtx: authorizationMocks.buildApiAuthCtx
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
  workspaceRole: 'editor',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const event = {} as AuthenticatedEvent;
const eventForAuthCtx = () => {
  authorizationMocks.buildApiAuthCtx.mockResolvedValueOnce(authCtx);
  return event;
};

const entitySchema: SchemaDbResult = {
  id: 'schema-app',
  workspace: 'ws-1',
  name: 'App',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'APP',
  created_at: now,
  updated_at: now
};

const makeEntity = (id: string): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: `APP-${id}`,
  slug: id,
  namespace: 'default',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: entitySchema.id,
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: entitySchema.name,
  completeness: 0
});

const inEntity = makeEntity('entity-in');
const outEntity = makeEntity('entity-out');

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Depends On',
  description: '',
  in_schema_ids: [entitySchema.id],
  out_schema_ids: [entitySchema.id],
  fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' } as never],
  groups: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  created_at: now,
  updated_at: now
};

const makeRelationRow = (overrides: Partial<RelationDbResult> = {}): RelationDbResult => ({
  id: 'relation-1',
  workspace: 'ws-1',
  schema_id: relationSchema.id,
  schema_name: relationSchema.name,
  in_entity_id: inEntity.id,
  in_entity_name: inEntity.name,
  out_entity_id: outEntity.id,
  out_entity_name: outEntity.name,
  data: {},
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

const makeDb = (
  existingRow?: RelationDbResult,
  existingVersions: EntityVersionSummaryDbResult[] = [],
  versionToRestore: EntityVersionDbResult | null = null,
  schemaOverride: RelationSchemaDbResult = relationSchema
) => {
  const createEntityVersion = vi.fn(async () => ({}));
  const pruneAutosaveVersions = vi.fn(async () => {});
  const createRelation = vi.fn(async () => makeRelationRow());
  const updateRelation = vi.fn(
    async (_ws: string, _id: string, input: { version: number; data: Record<string, unknown> }) =>
      makeRelationRow({ version: input.version, data: input.data, updated_at: new Date() })
  );
  const deleteRelation = vi.fn(async () => existingRow ?? makeRelationRow());

  const db = {
    relation: {
      getRelationSchema: vi.fn(async () => schemaOverride),
      listRelationSchemas: vi.fn(async () => [schemaOverride]),
      listRelations: vi.fn(async () => ({ items: [existingRow ?? makeRelationRow()], total: 1 })),
      listRelationSchemaVersions: vi.fn(async () => [
        {
          id: 'relation-schema-version-1',
          workspace: 'ws-1',
          schema_id: schemaOverride.id,
          version: 1,
          name: schemaOverride.name,
          description: schemaOverride.description,
          in_schema_ids: schemaOverride.in_schema_ids,
          out_schema_ids: schemaOverride.out_schema_ids,
          fields: schemaOverride.fields,
          groups: schemaOverride.groups,
          color: schemaOverride.color,
          icon: schemaOverride.icon,
          change_summary: {},
          created_by: null,
          created_at: now
        }
      ]),
      createRelation,
      updateRelation,
      deleteRelation,
      getRelation: vi.fn(async () => existingRow ?? makeRelationRow())
    },
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) =>
        id === inEntity.id ? inEntity : id === outEntity.id ? outEntity : null
      ),
      listSchemas: vi.fn(async () => [entitySchema]),
      listEntities: vi.fn(async () => [inEntity, outEntity]),
      createEntityVersion,
      pruneAutosaveVersions,
      listEntityVersions: vi.fn(async () => existingVersions),
      getEntityVersionById: vi.fn(async () => versionToRestore)
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    createEntityVersion,
    pruneAutosaveVersions,
    createRelation,
    updateRelation,
    deleteRelation
  };
};

describe('createWorkspaceRelation — version history', () => {
  it('writes a record_version row and prunes autosaves after creating a relation', async () => {
    const { db, createEntityVersion, pruneAutosaveVersions } = makeDb();

    const row = await createWorkspaceRelation(
      db,
      'ws-1',
      { _schemaId: relationSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
      eventForAuthCtx()
    );

    expect(row._uid).toBe('relation-1');
    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: 'relation-1',
        kind: 'autosave',
        version_number: 1,
        state: expect.objectContaining({
          id: 'relation-1',
          in_entity_id: inEntity.id,
          out_entity_id: outEntity.id
        })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', 'relation-1', 50);
  });
});

describe('createWorkspaceRelation — owner/lifecycle (#2708)', () => {
  it('defaults owner/lifecycle from the "in" entity when not overridden', async () => {
    const { db, createRelation } = makeDb();

    await createWorkspaceRelation(
      db,
      'ws-1',
      { _schemaId: relationSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
      eventForAuthCtx()
    );

    expect(createRelation).toHaveBeenCalledWith(
      expect.objectContaining({ owner: inEntity.owner, lifecycle: inEntity.lifecycle })
    );
  });

  it('rejects an explicit owner override without admin_relation on the target team', async () => {
    const { db } = makeDb();

    await expect(
      createWorkspaceRelation(
        db,
        'ws-1',
        {
          _schemaId: relationSchema.id,
          _inEntityId: inEntity.id,
          _outEntityId: outEntity.id,
          _owner: 'team-other'
        },
        eventForAuthCtx()
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('honors an explicit owner override when the caller is admin on the target team', async () => {
    const teamAdminAuthCtx = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-other', role: 'team_admin' }],
      schemas: [],
      entities: [],
      grants: []
    });
    authorizationMocks.buildApiAuthCtx.mockResolvedValueOnce(teamAdminAuthCtx);
    const { db, createRelation } = makeDb();

    await createWorkspaceRelation(
      db,
      'ws-1',
      {
        _schemaId: relationSchema.id,
        _inEntityId: inEntity.id,
        _outEntityId: outEntity.id,
        _owner: 'team-other'
      },
      event
    );

    expect(createRelation).toHaveBeenCalledWith(expect.objectContaining({ owner: 'team-other' }));
  });
});

describe('queryWorkspaceRelations (#2689)', () => {
  it('hides relations whose endpoint owner schemas are unavailable', async () => {
    const { db } = makeDb();
    vi.mocked(db.catalog.listSchemas).mockResolvedValue([]);

    const listed = await listWorkspaceRelations(db, 'ws-1', {}, {}, eventForAuthCtx());
    expect(listed).toEqual({ items: [], total: 0 });

    await expect(
      getWorkspaceRelation(db, 'ws-1', 'relation-1', eventForAuthCtx())
    ).rejects.toMatchObject({
      status: 404
    });
  });

  it('compiles and executes a relation-rooted query, redacting the result via toRedactedApiRelation', async () => {
    const row = makeRelationRow();
    const db = {
      core: { driver: 'sqlite' },
      relation: {
        listRelationSchemas: vi.fn(async () => [relationSchema]),
        listRelations: vi.fn(async () => ({ items: [row], total: 1 })),
        runCompiledRelationQuery: vi.fn(async () => [{ ...row, projections: {} }]),
        runCompiledRelationCountQuery: vi.fn(async () => 1)
      },
      catalog: {
        listSchemas: vi.fn(async () => [entitySchema]),
        listEntities: vi.fn(async () => [inEntity, outEntity]),
        runCompiledEntityQuery: vi.fn(async () => [])
      }
    } as unknown as DatabaseAdapter;

    const page = await queryWorkspaceRelations(
      db,
      'ws-1',
      { schemaId: relationSchema.id, root: { kind: 'and', children: [] } },
      {},
      eventForAuthCtx()
    );

    expect(page.total).toBe(1);
    expect(page.items[0]!._uid).toBe(row.id);
    expect(db.relation.runCompiledRelationQuery).toHaveBeenCalledTimes(1);
    expect(db.relation.runCompiledRelationCountQuery).toHaveBeenCalledTimes(1);
    expect(db.relation.listRelations).not.toHaveBeenCalled();
    expect(db.catalog.listEntities).not.toHaveBeenCalled();
    const [sql] = (db.relation.runCompiledRelationQuery as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(sql).toContain('scoped_relation');
  });

  it('rejects an invalid relation-rooted query with a 400', async () => {
    const db = {
      core: { driver: 'sqlite' },
      relation: {
        listRelationSchemas: vi.fn(async () => [relationSchema]),
        listRelations: vi.fn(async () => ({ items: [], total: 0 })),
        runCompiledRelationQuery: vi.fn(async () => []),
        runCompiledRelationCountQuery: vi.fn(async () => 0)
      },
      catalog: {
        listSchemas: vi.fn(async () => [entitySchema]),
        listEntities: vi.fn(async () => [])
      }
    } as unknown as DatabaseAdapter;

    await expect(
      queryWorkspaceRelations(
        db,
        'ws-1',
        {
          schemaId: relationSchema.id,
          root: { kind: 'predicate', path: [], fieldId: 'unknown_field', op: 'equals', value: 'x' }
        },
        {},
        eventForAuthCtx()
      )
    ).rejects.toThrow();
  });

  it('pushes limit/offset into the compiled SQL and returns the server-computed total (#2700)', async () => {
    const row = makeRelationRow();
    const runCompiledRelationQuery = vi.fn(async (_sql: string, _params: unknown[]) => [
      { ...row, projections: {} }
    ]);
    const runCompiledRelationCountQuery = vi.fn(async (_sql: string, _params: unknown[]) => 42);
    const db = {
      core: { driver: 'sqlite' },
      relation: {
        listRelationSchemas: vi.fn(async () => [relationSchema]),
        listRelations: vi.fn(async () => ({ items: [row], total: 1 })),
        runCompiledRelationQuery,
        runCompiledRelationCountQuery
      },
      catalog: {
        listSchemas: vi.fn(async () => [entitySchema]),
        listEntities: vi.fn(async () => [inEntity, outEntity]),
        runCompiledEntityQuery: vi.fn(async () => [])
      }
    } as unknown as DatabaseAdapter;

    const page = await queryWorkspaceRelations(
      db,
      'ws-1',
      { schemaId: relationSchema.id, root: { kind: 'and', children: [] } },
      { limit: 25, offset: 50 },
      eventForAuthCtx()
    );

    // total comes from the COUNT query, not items.length, so it can exceed the page size.
    expect(page.total).toBe(42);
    expect(page.items).toHaveLength(1);

    const [rowSql, rowParams] = runCompiledRelationQuery.mock.calls[0]!;
    expect(rowSql).toMatch(/LIMIT \?\s*OFFSET \?\s*$/);
    expect(rowParams.slice(-2)).toEqual([25, 50]);

    const [countSql] = runCompiledRelationCountQuery.mock.calls[0]!;
    expect(countSql).toContain('SELECT COUNT(*) AS count');
    expect(countSql).not.toContain('LIMIT');
  });
});

describe('updateWorkspaceRelation — version history', () => {
  it('writes a new record_version row reflecting the bumped version on update', async () => {
    const existing = makeRelationRow({ version: 1, data: { note: 'before' } });
    const { db, createEntityVersion, pruneAutosaveVersions } = makeDb(existing);

    await updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx());

    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: existing.id,
        kind: 'autosave',
        version_number: 2,
        state: expect.objectContaining({ data: { note: 'after' } })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', existing.id, 50);
  });

  it('ignores reserved endpoint metadata in the update body — endpoints are immutable after creation', async () => {
    const existing = makeRelationRow({ version: 1, data: { note: 'before' } });
    const { db, updateRelation } = makeDb(existing);

    // _inEntityId/_outEntityId are the reserved (underscore-prefixed) metadata keys the create
    // body uses for endpoints (relationContract.ts's relationCreateBodySchema) — a client sending
    // them on update (there is no such field in relationUpdateBodySchema, but nothing stops a
    // caller from including them) must not be able to move a relation's endpoints this way.
    const row = await updateWorkspaceRelation(
      db,
      'ws-1',
      existing.id,
      { note: 'after', _inEntityId: 'some-other-entity', _outEntityId: 'yet-another-entity' },
      eventForAuthCtx()
    );

    // RelationDbUpdate has no endpoint fields at all — nothing endpoint-related reaches the DB
    // layer regardless of what a client sends in the body, and the reserved keys are stripped
    // before merging into field data rather than silently stored under those names.
    expect(updateRelation).toHaveBeenCalledWith(
      'ws-1',
      existing.id,
      expect.objectContaining({ data: { note: 'after' } })
    );
    const updateCallArgs = updateRelation.mock.calls[0]![2] as Record<string, unknown>;
    expect(Object.keys(updateCallArgs)).not.toContain('in_entity_id');
    expect(Object.keys(updateCallArgs)).not.toContain('out_entity_id');
    expect(updateCallArgs['data']).toEqual({ note: 'after' });

    expect(row._in.id).toBe(inEntity.id);
    expect(row._out.id).toBe(outEntity.id);
  });
});

describe('deleteWorkspaceRelation — version history', () => {
  it('soft-deletes and writes a deleted record_version continuing the version sequence', async () => {
    const existing = makeRelationRow({ version: 2 });
    const priorVersions = [
      { version_number: 1 },
      { version_number: 2 }
    ] as EntityVersionSummaryDbResult[];
    const { db, createEntityVersion, deleteRelation } = makeDb(existing, priorVersions);

    const result = await deleteWorkspaceRelation(db, 'ws-1', existing.id, eventForAuthCtx());

    expect(result.success).toBe(true);
    expect(deleteRelation).toHaveBeenCalledWith('ws-1', existing.id);
    expect(createEntityVersion).toHaveBeenCalledTimes(1);
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: existing.id,
        kind: 'deleted',
        version_number: 3,
        state: expect.objectContaining({ id: existing.id })
      })
    );
  });
});

describe('restoreWorkspaceRelationVersion', () => {
  it('re-applies the version data, writes a restored record_version, and returns the restored-from version', async () => {
    const existing = makeRelationRow({ version: 2, data: { note: 'current' } });
    const versionToRestore: EntityVersionDbResult = {
      id: 'version-1',
      workspace: 'ws-1',
      record_id: existing.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: now,
      created_by: 'user-1',
      created_by_name: 'User',
      // Endpoint fields are always immutable in practice, but the stored state snapshot happens
      // to carry them (relationToBaseState) — restore must ignore them regardless.
      state: {
        id: existing.id,
        in_entity_id: 'some-other-entity',
        out_entity_id: 'yet-another-entity',
        data: { note: 'old' }
      },
      applied_case_revision_id: null
    };
    const { db, createEntityVersion, updateRelation, pruneAutosaveVersions } = makeDb(
      existing,
      [],
      versionToRestore
    );

    const result = await restoreWorkspaceRelationVersion(
      db,
      'ws-1',
      existing.id,
      'version-1',
      'restoring an old note',
      eventForAuthCtx()
    );

    expect(updateRelation).toHaveBeenCalledWith(
      'ws-1',
      existing.id,
      expect.objectContaining({ data: { note: 'old' }, version: 3 })
    );
    const restoreCallArgs = updateRelation.mock.calls[0]![2] as Record<string, unknown>;
    expect(Object.keys(restoreCallArgs)).not.toContain('in_entity_id');
    expect(Object.keys(restoreCallArgs)).not.toContain('out_entity_id');
    expect(createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: existing.id,
        kind: 'restored',
        version_number: 3,
        commit_message: 'restoring an old note',
        state: expect.objectContaining({ data: { note: 'old' } })
      })
    );
    expect(pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', existing.id, 50);
    // The response reflects the version that was restored from, mirroring entityVersionOrpc.ts.
    expect(result.id).toBe('version-1');
  });
});

describe('relation approval policy resolution', () => {
  const requiredSchema: RelationSchemaDbResult = {
    ...relationSchema,
    relation_approval_policy: 'required'
  };

  it('never gates create, even under a required-approval schema (mirrors entity create)', async () => {
    const { db } = makeDb(undefined, [], null, requiredSchema);

    await expect(
      createWorkspaceRelation(
        db,
        'ws-1',
        { _schemaId: requiredSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
        eventForAuthCtx()
      )
    ).resolves.toMatchObject({ _uid: 'relation-1' });
  });

  it('never gates delete, even under a required-approval schema (mirrors entity delete)', async () => {
    const existing = makeRelationRow({ schema_id: requiredSchema.id });
    const { db } = makeDb(existing, [], null, requiredSchema);

    await expect(
      deleteWorkspaceRelation(db, 'ws-1', existing.id, eventForAuthCtx())
    ).resolves.toMatchObject({ success: true });
  });

  it('blocks a direct update when the schema requires approval and there is no override', async () => {
    const existing = makeRelationRow({
      schema_id: requiredSchema.id,
      approval_policy_override: null
    });
    const { db } = makeDb(existing, [], null, requiredSchema);

    await expect(
      updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx())
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows a direct update when an instance override disables approval despite a required schema policy', async () => {
    const existing = makeRelationRow({
      schema_id: requiredSchema.id,
      approval_policy_override: 'disabled'
    });
    const { db } = makeDb(existing, [], null, requiredSchema);

    await expect(
      updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx())
    ).resolves.toMatchObject({ _uid: existing.id });
  });

  it('blocks a direct update when an instance override requires approval despite a disabled schema policy', async () => {
    const existing = makeRelationRow({ approval_policy_override: 'required' });
    const { db } = makeDb(existing);

    await expect(
      updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx())
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows a direct update under a disabled schema policy with no override', async () => {
    const existing = makeRelationRow({ approval_policy_override: null });
    const { db } = makeDb(existing);

    await expect(
      updateWorkspaceRelation(db, 'ws-1', existing.id, { note: 'after' }, eventForAuthCtx())
    ).resolves.toMatchObject({ _uid: existing.id });
  });
});
