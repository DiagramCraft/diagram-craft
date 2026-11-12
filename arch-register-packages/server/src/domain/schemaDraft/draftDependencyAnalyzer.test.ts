import { describe, expect, it } from 'vitest';
import { applyDraftItems, type CatalogSnapshot } from './draftCatalog';
import { analyzeDraftDependencies } from './draftDependencyAnalyzer';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';

const now = new Date('2026-01-01T00:00:00Z');
const options = { workspace: 'ws', teamIds: new Set<string>(), now };

const schema = (id: string, fields: SchemaDbResult['fields'] = []): SchemaDbResult => ({
  id,
  workspace: 'ws',
  name: id.toUpperCase(),
  description: '',
  fields,
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'AAA',
  version: 1,
  created_at: now,
  updated_at: now
});

const relation = (id: string, inIds: string[], outIds: string[]): RelationSchemaDbResult => ({
  id,
  workspace: 'ws',
  name: id,
  description: '',
  in_schema_ids: inIds,
  out_schema_ids: outIds,
  fields: [],
  color: null,
  icon: null,
  version: 1,
  created_at: now,
  updated_at: now
});

const live = (over: Partial<CatalogSnapshot>): CatalogSnapshot => ({
  schemas: [],
  relationSchemas: [],
  documentTypes: [],
  enums: [],
  fieldGroups: [],
  categories: [],
  ...over
});

describe('analyzeDraftDependencies', () => {
  it('reports nothing for an empty draft', () => {
    const catalog = applyDraftItems(live({ schemas: [schema('a')] }), [], options);
    expect(analyzeDraftDependencies(catalog, { queryConsumers: [] })).toEqual([]);
  });

  it('blocks deleting a schema used by a relation endpoint', () => {
    const catalog = applyDraftItems(
      live({ schemas: [schema('a'), schema('b')], relationSchemas: [relation('r', ['a'], ['b'])] }),
      [{ kind: 'entity_schema', item_id: 'a', op: 'delete', payload: null }],
      options
    );
    const findings = analyzeDraftDependencies(catalog, { queryConsumers: [] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'blocking', category: 'relation_endpoint' });
  });

  it('blocks a saved view whose schema is deleted, but not one already broken', () => {
    const catalog = applyDraftItems(
      live({ schemas: [schema('a')] }),
      [{ kind: 'entity_schema', item_id: 'a', op: 'delete', payload: null }],
      options
    );
    const findings = analyzeDraftDependencies(catalog, {
      queryConsumers: [
        {
          type: 'saved_view',
          id: 'v1',
          name: 'Good',
          query: { schemaId: 'a', root: { kind: 'and', children: [] } } as never
        },
        {
          type: 'saved_view',
          id: 'v2',
          name: 'Already broken',
          query: { schemaId: 'zzz', root: { kind: 'and', children: [] } } as never
        }
      ]
    });
    expect(findings.map(f => f.subject.id)).toEqual(['v1']);
  });
});
