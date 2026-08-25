import { describe, expect, it } from 'vitest';
import type { SchemaDbResult } from './db/catalogDatabase';
import { resolveTextQuery } from './entityQueryTextResolver';
import type { TextQuerySyntax } from './entityQueryTextTypes';

const schema: SchemaDbResult = {
  id: 'technology-id',
  workspace: 'workspace-id',
  name: 'Technology',
  description: '',
  fields: [{ id: 'category', name: 'Category', type: 'text' }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'TEC',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const syntax: TextQuerySyntax = {
  topLevelSchemaRefs: [],
  root: {
    kind: 'path',
    steps: [
      {
        kind: 'field',
        field: { value: 'category', offset: 0 },
        offset: 0
      }
    ],
    comparator: { text: '=', offset: 9 },
    value: { kind: 'literal', value: 'library', offset: 11 },
    endOffset: 20
  }
};

describe('entity query text resolver', () => {
  it('resolves a syntax tree to IR without tokenization or parser state', () => {
    expect(
      resolveTextQuery(syntax, {
        schemas: new Map([[schema.id, schema]]),
        enums: new Map(),
        authCtx: null,
        relationSchemas: new Map()
      })
    ).toEqual({
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'category',
        op: 'equals',
        value: 'library'
      }
    });
  });
});
