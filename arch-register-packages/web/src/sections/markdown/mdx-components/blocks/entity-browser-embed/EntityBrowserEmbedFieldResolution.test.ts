import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { resolveEntityQuery, resolveTableFieldIds } from './EntityBrowserEmbedFieldResolution';

const rootSchema: EntitySchema = {
  id: 'schema-term-real-id',
  name: 'Term',
  fields: [
    {
      id: 'field-categories-real-id',
      name: 'Categories',
      type: 'reference',
      requirementLevel: 'optional'
    },
    { id: 'field-status-real-id', name: 'Status', type: 'select', requirementLevel: 'optional' }
  ]
} as unknown as EntitySchema;

describe('resolveTableFieldIds', () => {
  it('resolves schema field names, leaves standard fields and unresolved names untouched', () => {
    const resolved = resolveTableFieldIds(
      { fieldIds: ['_owner', 'Categories', 'Missing Field'] },
      rootSchema
    );
    expect(resolved).toEqual({
      fieldIds: ['_owner', 'field-categories-real-id', 'Missing Field']
    });
  });

  it('passes through unchanged when there is no root schema', () => {
    const config = { fieldIds: ['Categories'] };
    expect(resolveTableFieldIds(config, undefined)).toBe(config);
  });

  it('passes through a config with no fieldIds array', () => {
    const config = { xAxis: 'impact' };
    expect(resolveTableFieldIds(config, rootSchema)).toBe(config);
  });
});

describe('resolveEntityQuery', () => {
  it('resolves a relationExists path, a predicate fieldId, and a projection, and pins schemaId', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'relationExists', path: [{ kind: 'forward', fieldId: 'Categories' }] },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] },
          { kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'active' }
        ]
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'Categories' }],
          fieldId: '_name',
          alias: 'Category'
        }
      ]
    };

    const resolved = resolveEntityQuery(query, rootSchema, 'schema-term-real-id');

    expect(resolved).toEqual({
      schemaId: 'schema-term-real-id',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'relationExists',
            path: [{ kind: 'forward', fieldId: 'field-categories-real-id' }]
          },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] },
          {
            kind: 'predicate',
            path: [],
            fieldId: 'field-status-real-id',
            op: 'equals',
            value: 'active'
          }
        ]
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'field-categories-real-id' }],
          fieldId: '_name',
          alias: 'Category'
        }
      ]
    });
  });

  it('recurses through or/not nodes', () => {
    const query: EntityQuery = {
      root: {
        kind: 'not',
        child: {
          kind: 'or',
          children: [{ kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'a' }]
        }
      }
    };

    const resolved = resolveEntityQuery(query, rootSchema, null);

    expect(resolved.root).toEqual({
      kind: 'not',
      child: {
        kind: 'or',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: 'field-status-real-id',
            op: 'equals',
            value: 'a'
          }
        ]
      }
    });
  });

  it('leaves an unresolvable name and a freeText node untouched', () => {
    const query: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: 'Nonexistent', op: 'equals', value: 'x' },
          { kind: 'freeText', value: 'search text' }
        ]
      }
    };

    const resolved = resolveEntityQuery(query, rootSchema, null);

    expect(resolved.root).toEqual({
      kind: 'and',
      children: [
        { kind: 'predicate', path: [], fieldId: 'Nonexistent', op: 'equals', value: 'x' },
        { kind: 'freeText', value: 'search text' }
      ]
    });
  });

  it('passes through unchanged when there is no root schema', () => {
    const query: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'Status', op: 'equals', value: 'a' }
    };
    expect(resolveEntityQuery(query, undefined, null)).toBe(query);
  });
});
