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
  direction: 'out'
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
      getEntity: vi.fn(async (_ws: string, id: string) => entities.get(id) ?? null)
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
        field: outField,
        delta: { delete: ['rel-1'] },
        authCtx: null,
        actor
      })
    ).rejects.toThrow();

    expect(db.relation.deleteRelation).not.toHaveBeenCalled();
  });
});
