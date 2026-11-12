import { describe, expect, it } from 'vitest';
import { applyDraftItems, type CatalogSnapshot } from './draftCatalog';
import { validateRecordsAgainstCatalog } from './draftRecordValidation';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';

const now = new Date('2026-01-01T00:00:00Z');
const options = { workspace: 'ws', teamIds: new Set<string>(), now };

const schema: SchemaDbResult = {
  id: 'a',
  workspace: 'ws',
  name: 'A',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'AAA',
  version: 1,
  created_at: now,
  updated_at: now,
  fields: [{ id: 'f', name: 'F', type: 'text', requirementLevel: 'optional' }] as never
};
const live: CatalogSnapshot = {
  schemas: [schema],
  relationSchemas: [],
  documentTypes: [],
  enums: [],
  fieldGroups: [],
  categories: []
};
const entity = (id: string, data: Record<string, unknown>) =>
  ({ id, schema_id: 'a', data }) as unknown as EntityDbResult;

describe('validateRecordsAgainstCatalog', () => {
  it('reports required fields that are newly required and empty', () => {
    const { draft } = applyDraftItems(
      live,
      [
        {
          kind: 'entity_schema',
          item_id: 'a',
          op: 'update',
          payload: {
            name: 'A',
            fields: [{ id: 'f', name: 'F', type: 'text', requirementLevel: 'required' }]
          }
        }
      ],
      options
    );
    const result = validateRecordsAgainstCatalog(
      live,
      draft,
      [entity('1', {}), entity('2', { f: 'x' })],
      []
    );
    expect(result.problemCount).toBe(1);
    expect(result.groups[0]).toMatchObject({ problem: 'required_missing', fieldId: 'f', count: 1 });
  });

  it('reports records of a deleted schema', () => {
    const { draft } = applyDraftItems(
      live,
      [{ kind: 'entity_schema', item_id: 'a', op: 'delete', payload: null }],
      options
    );
    const result = validateRecordsAgainstCatalog(live, draft, [entity('1', {})], []);
    expect(result.groups[0]).toMatchObject({ problem: 'schema_deleted', count: 1 });
  });

  it('reports nothing when the draft is empty', () => {
    const { draft } = applyDraftItems(live, [], options);
    expect(validateRecordsAgainstCatalog(live, draft, [entity('1', {})], []).problemCount).toBe(0);
  });
});
