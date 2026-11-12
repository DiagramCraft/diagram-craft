import { describe, expect, it } from 'vitest';
import { applyDraftItems, type CatalogSnapshot } from './draftCatalog';
import type { SchemaDbResult, SharedFieldGroupDbResult } from '../catalog/db/catalogDatabase';

const now = new Date('2026-01-01T00:00:00Z');

const schema = (id: string, name: string): SchemaDbResult => ({
  id,
  workspace: 'ws',
  name,
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'AAA',
  version: 1,
  created_at: now,
  updated_at: now
});

const emptyLive = (schemas: SchemaDbResult[] = []): CatalogSnapshot => ({
  schemas,
  relationSchemas: [],
  documentTypes: [],
  enums: [],
  fieldGroups: [] as SharedFieldGroupDbResult[],
  categories: []
});

const options = { workspace: 'ws', teamIds: new Set<string>(), now };

describe('applyDraftItems', () => {
  it('does not mutate the live snapshot', () => {
    const live = emptyLive([schema('a', 'A')]);
    applyDraftItems(
      live,
      [{ kind: 'entity_schema', item_id: 'a', op: 'delete', payload: null }],
      options
    );
    expect(live.schemas).toHaveLength(1);
  });

  it('applies create, update and delete', () => {
    const live = emptyLive([schema('a', 'A'), schema('b', 'B')]);
    const result = applyDraftItems(
      live,
      [
        { kind: 'entity_schema', item_id: 'a', op: 'update', payload: { name: 'A2' } },
        { kind: 'entity_schema', item_id: 'b', op: 'delete', payload: null },
        {
          kind: 'entity_schema',
          item_id: 'c',
          op: 'create',
          payload: { name: 'C', key_prefix: 'CCC' }
        }
      ],
      options
    );
    expect(result.issues).toEqual([]);
    expect(result.draft.schemas.map(s => [s.id, s.name])).toEqual([
      ['a', 'A2'],
      ['c', 'C']
    ]);
    expect(result.changes.find(c => c.itemId === 'a')).toMatchObject({ name: 'A2', liveName: 'A' });
  });

  it('reports invalid payloads as issues instead of throwing', () => {
    const result = applyDraftItems(
      emptyLive(),
      [{ kind: 'entity_schema', item_id: 'x', op: 'create', payload: {} }],
      options
    );
    expect(result.issues).toHaveLength(1);
    expect(result.draft.schemas).toHaveLength(0);
  });
});
