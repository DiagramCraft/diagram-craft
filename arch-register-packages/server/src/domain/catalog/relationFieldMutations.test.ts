import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import { applyRelationFieldDelta } from './relationFieldMutations';

const now = new Date('2026-06-29T12:00:00.000Z');

const outField: TypedRelationField = {
  id: 'deps',
  name: 'Depends on',
  requirementLevel: null,
  type: 'typedRelation',
  relationSchemaId: 'rel-schema-1',
  direction: 'out',
  minCount: 0,
  maxCount: -1
};

const ownerSchema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Owner schema',
  description: '',
  fields: [outField],
  groups: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'OWN',
  created_at: now,
  updated_at: now
};

const makeDb = () => {
  const relationRows = new Map<string, Record<string, unknown>>([
    [
      'rel-1',
      {
        id: 'rel-1',
        workspace: 'ws-1',
        schema_id: 'rel-schema-1',
        schema_name: 'Dependency',
        in_entity_id: 'entity-2',
        in_entity_name: 'Other',
        out_entity_id: 'entity-1',
        out_entity_name: 'My Entity',
        data: { note: 'original' },
        version: 1,
        created_at: now,
        updated_at: now
      }
    ]
  ]);
  const entities = new Map([
    ['entity-1', { id: 'entity-1', schema_id: 'schema-1' }],
    ['entity-2', { id: 'entity-2', schema_id: 'schema-2' }]
  ]);
  return {
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) => entities.get(id) ?? null),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {}),
      listEntityVersions: vi.fn(async () => [])
    },
    relation: {
      getRelationSchema: vi.fn(async () => ({
        id: 'rel-schema-1',
        workspace: 'ws-1',
        name: 'Dependency',
        description: '',
        in_schema_ids: ['schema-2'],
        out_schema_ids: ['schema-1'],
        fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
        groups: [],
        created_at: now,
        updated_at: now
      })),
      getRelation: vi.fn(async (_ws: string, id: string) => relationRows.get(id) ?? null),
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
      updateRelation: vi.fn(async (_ws: string, id: string, input: Record<string, unknown>) => {
        const row = { ...relationRows.get(id), ...input };
        relationRows.set(id, row);
        return row;
      }),
      deleteRelation: vi.fn(async (_ws: string, id: string) => {
        const existing = relationRows.get(id) ?? null;
        relationRows.delete(id);
        return existing;
      })
    },
    audit: { createAuditLog: vi.fn(async () => ({ id: 'audit-1' })) },
    watch: {
      listWatcherUserIds: vi.fn(async () => []),
      createNotificationsFromAudit: vi.fn(async () => {})
    }
  } as unknown as DatabaseAdapter;
};

const actor = { id: 'user-1', displayName: 'User' };

describe('applyRelationFieldDelta', () => {
  it('updates an existing relation instance owned by this entity', async () => {
    const db = makeDb();

    const results = await applyRelationFieldDelta(db, {
      workspace: 'ws-1',
      ownerEntityId: 'entity-1',
      ownerSchema,
      field: outField,
      delta: { update: [{ id: 'rel-1', data: { note: 'changed' } }] },
      authCtx: null,
      actor
    });

    expect(results[0]?.note).toBe('changed');
    expect(db.relation.updateRelation).toHaveBeenCalled();
  });

  it('rejects updating a relation instance not connected to this entity', async () => {
    const db = makeDb();

    await expect(
      applyRelationFieldDelta(db, {
        workspace: 'ws-1',
        ownerEntityId: 'entity-3',
        ownerSchema,
        field: outField,
        delta: { update: [{ id: 'rel-1', data: { note: 'changed' } }] },
        authCtx: null,
        actor
      })
    ).rejects.toThrow();

    expect(db.relation.updateRelation).not.toHaveBeenCalled();
  });

  it('deletes a relation instance owned by this entity', async () => {
    const db = makeDb();

    await applyRelationFieldDelta(db, {
      workspace: 'ws-1',
      ownerEntityId: 'entity-1',
      ownerSchema,
      field: outField,
      delta: { delete: ['rel-1'] },
      authCtx: null,
      actor
    });

    expect(db.relation.deleteRelation).toHaveBeenCalledWith('ws-1', 'rel-1');
  });

  it('rejects deleting a relation instance not connected to this entity', async () => {
    const db = makeDb();

    await expect(
      applyRelationFieldDelta(db, {
        workspace: 'ws-1',
        ownerEntityId: 'entity-3',
        ownerSchema,
        field: outField,
        delta: { delete: ['rel-1'] },
        authCtx: null,
        actor
      })
    ).rejects.toThrow();

    expect(db.relation.deleteRelation).not.toHaveBeenCalled();
  });
});

describe('applyRelationFieldDelta — version history', () => {
  it('writes a record_version row and prunes autosaves after creating a relation', async () => {
    const db = makeDb();

    await applyRelationFieldDelta(db, {
      workspace: 'ws-1',
      ownerEntityId: 'entity-1',
      ownerSchema,
      field: outField,
      delta: { create: [{ otherEntityId: 'entity-2', data: { note: 'new' } }] },
      authCtx: null,
      actor
    });

    expect(db.catalog.createEntityVersion).toHaveBeenCalledTimes(1);
    expect(db.catalog.createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'autosave', version_number: 1, created_by: 'user-1' })
    );
    expect(db.catalog.pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', expect.any(String), 50);
  });

  it('writes a record_version row and prunes autosaves after updating a relation', async () => {
    const db = makeDb();

    await applyRelationFieldDelta(db, {
      workspace: 'ws-1',
      ownerEntityId: 'entity-1',
      ownerSchema,
      field: outField,
      delta: { update: [{ id: 'rel-1', data: { note: 'changed' } }] },
      authCtx: null,
      actor
    });

    expect(db.catalog.createEntityVersion).toHaveBeenCalledTimes(1);
    expect(db.catalog.createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({ record_id: 'rel-1', kind: 'autosave', created_by: 'user-1' })
    );
    expect(db.catalog.pruneAutosaveVersions).toHaveBeenCalledWith('ws-1', 'rel-1', 50);
  });

  it('writes a deleted-kind record_version row after deleting a relation', async () => {
    const db = makeDb();
    (db.catalog.listEntityVersions as ReturnType<typeof vi.fn>).mockResolvedValue([
      { version_number: 1 },
      { version_number: 2 }
    ]);

    await applyRelationFieldDelta(db, {
      workspace: 'ws-1',
      ownerEntityId: 'entity-1',
      ownerSchema,
      field: outField,
      delta: { delete: ['rel-1'] },
      authCtx: null,
      actor
    });

    expect(db.catalog.createEntityVersion).toHaveBeenCalledTimes(1);
    expect(db.catalog.createEntityVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        record_id: 'rel-1',
        kind: 'deleted',
        version_number: 3,
        created_by: 'user-1'
      })
    );
    expect(db.catalog.pruneAutosaveVersions).not.toHaveBeenCalled();
  });
});
