import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { CatalogRecordExternalIdentityRow } from '../externalIdentity/db/externalIdentityDatabase';
import { getRelationByExternalKey, syncRelationByExternalKey } from './relationSyncOperations';

vi.mock('../audit/db/auditLogging', async () => ({
  ...(await vi.importActual<typeof import('../audit/db/auditLogging')>('../audit/db/auditLogging')),
  logAudit: vi.fn(async () => {})
}));

const SOURCE = 'backstage';
const EXTERNAL_KEY = 'relation:default/foo';

const now = new Date('2026-06-29T12:00:00.000Z');
const actor = { id: 'user-1', displayName: 'User One' };

const editorAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'editor',
  workspaceCapabilityCeiling: ['ws.view', 'content.view', 'ent.edit', 'ent.external_update'],
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const viewerAuthCtx = buildAuthorizationContext({
  userId: 'user-2',
  globalRoles: [],
  workspaceRole: 'viewer',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

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

const makeEntity = (id: string): EntityDbResult =>
  ({
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
  }) as EntityDbResult;

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

const makeDb = (existingRow?: RelationDbResult | null) => {
  let identity: CatalogRecordExternalIdentityRow | null = existingRow
    ? {
        workspace: 'ws-1',
        source: SOURCE,
        external_key: EXTERNAL_KEY,
        record_id: existingRow.id,
        created_at: now,
        updated_at: now
      }
    : null;
  let stored = existingRow ?? null;

  const createRelation = vi.fn(async () => {
    stored = makeRelationRow();
    return stored;
  });
  const updateRelation = vi.fn(
    async (_ws: string, _id: string, input: { version: number; data: Record<string, unknown> }) => {
      stored = makeRelationRow({
        ...stored,
        version: input.version,
        data: input.data,
        updated_at: new Date()
      });
      return stored;
    }
  );

  const db = {
    core: {
      transaction: vi.fn(async (fn: (db: DatabaseAdapter) => unknown) =>
        fn(db as unknown as DatabaseAdapter)
      )
    },
    externalIdentity: {
      find: vi.fn(async () => identity),
      create: vi.fn(async (row: CatalogRecordExternalIdentityRow) => {
        identity = { ...row, created_at: now, updated_at: now };
        return identity;
      })
    },
    relation: {
      getRelationSchema: vi.fn(async () => relationSchema),
      getRelation: vi.fn(async () => stored),
      createRelation,
      updateRelation
    },
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) =>
        id === inEntity.id ? inEntity : id === outEntity.id ? outEntity : null
      ),
      listSchemas: vi.fn(async () => [entitySchema]),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    }
  } as unknown as DatabaseAdapter;

  return { db, createRelation, updateRelation };
};

describe('syncRelationByExternalKey', () => {
  it('creates a relation on first sync and records the external identity', async () => {
    const { db } = makeDb();

    const result = await syncRelationByExternalKey(
      db,
      'ws-1',
      SOURCE,
      EXTERNAL_KEY,
      { _schemaId: relationSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
      editorAuthCtx,
      actor
    );

    expect(result.status).toBe('created');
    expect(db.externalIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspace: 'ws-1', source: SOURCE, external_key: EXTERNAL_KEY })
    );
  });

  it('returns unchanged for an identical repeat sync', async () => {
    const existing = makeRelationRow({ data: { note: 'v1' } });
    const { db } = makeDb(existing);

    const result = await syncRelationByExternalKey(
      db,
      'ws-1',
      SOURCE,
      EXTERNAL_KEY,
      {
        _schemaId: relationSchema.id,
        _inEntityId: inEntity.id,
        _outEntityId: outEntity.id,
        note: 'v1'
      },
      editorAuthCtx,
      actor
    );

    expect(result.status).toBe('unchanged');
    expect(db.relation.updateRelation).not.toHaveBeenCalled();
  });

  it('returns updated when a field value changes', async () => {
    const existing = makeRelationRow({ data: { note: 'v1' } });
    const { db } = makeDb(existing);

    const result = await syncRelationByExternalKey(
      db,
      'ws-1',
      SOURCE,
      EXTERNAL_KEY,
      {
        _schemaId: relationSchema.id,
        _inEntityId: inEntity.id,
        _outEntityId: outEntity.id,
        note: 'v2'
      },
      editorAuthCtx,
      actor
    );

    expect(result.status).toBe('updated');
    expect(db.relation.updateRelation).toHaveBeenCalledTimes(1);
  });

  it('rejects a payload with a field id not defined on the schema', async () => {
    const { db } = makeDb();

    await expect(
      syncRelationByExternalKey(
        db,
        'ws-1',
        SOURCE,
        EXTERNAL_KEY,
        {
          _schemaId: relationSchema.id,
          _inEntityId: inEntity.id,
          _outEntityId: outEntity.id,
          bogusField: 'x'
        },
        editorAuthCtx,
        actor
      )
    ).rejects.toThrow();
  });

  it('rejects changing the schema of an existing external identity', async () => {
    const existing = makeRelationRow();
    const { db } = makeDb(existing);

    await expect(
      syncRelationByExternalKey(
        db,
        'ws-1',
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: 'other-schema', _inEntityId: inEntity.id, _outEntityId: outEntity.id },
        editorAuthCtx,
        actor
      )
    ).rejects.toThrow();
  });

  it('rejects changing the endpoints of an existing external identity', async () => {
    const existing = makeRelationRow();
    const { db } = makeDb(existing);

    await expect(
      syncRelationByExternalKey(
        db,
        'ws-1',
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: relationSchema.id, _inEntityId: outEntity.id, _outEntityId: inEntity.id },
        editorAuthCtx,
        actor
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires the ent.external_update capability', async () => {
    const { db } = makeDb();

    await expect(
      syncRelationByExternalKey(
        db,
        'ws-1',
        SOURCE,
        EXTERNAL_KEY,
        { _schemaId: relationSchema.id, _inEntityId: inEntity.id, _outEntityId: outEntity.id },
        viewerAuthCtx,
        actor
      )
    ).rejects.toThrow();
  });
});

describe('getRelationByExternalKey', () => {
  it('returns 404 when no identity is recorded', async () => {
    const { db } = makeDb();

    await expect(
      getRelationByExternalKey(db, 'ws-1', SOURCE, EXTERNAL_KEY, editorAuthCtx)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('resolves the relation for a recorded identity', async () => {
    const existing = makeRelationRow();
    const { db } = makeDb(existing);

    const result = await getRelationByExternalKey(db, 'ws-1', SOURCE, EXTERNAL_KEY, editorAuthCtx);
    expect(result['_uid']).toBe(existing.id);
  });
});
