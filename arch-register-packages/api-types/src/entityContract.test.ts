import { describe, expect, it } from 'vitest';
import { entityListFiltersSchema } from './entityContract';

describe('entityListFiltersSchema', () => {
  it('accepts typed conditions and booleans', () => {
    expect(
      entityListFiltersSchema.parse({
        conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
        includeProjectSnapshots: false
      })
    ).toEqual({
      conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
      includeProjectSnapshots: false
    });
  });

  it('normalizes legacy serialized query values', () => {
    expect(
      entityListFiltersSchema.parse({
        conditions: JSON.stringify([{ fieldId: '_name', op: 'contains', value: 'Auth' }]),
        includeProjectSnapshots: 'true'
      })
    ).toEqual({
      conditions: [{ fieldId: '_name', op: 'contains', value: 'Auth' }],
      includeProjectSnapshots: true
    });
  });

  it('accepts a structured EntityQuery as a JSON query parameter', () => {
    const query = {
      schemaId: 'schema-component',
      root: {
        kind: 'predicate' as const,
        path: [],
        fieldId: '_name',
        op: 'contains' as const,
        value: 'API'
      },
      projections: [{ path: [], fieldId: '_slug', alias: 'slug' }]
    };

    expect(
      entityListFiltersSchema.parse({ entityQuery: JSON.stringify(query) }).entityQuery
    ).toEqual(query);
  });
});
