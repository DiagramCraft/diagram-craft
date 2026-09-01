import { describe, expect, it } from 'vitest';
import type { QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  asFieldPredicate,
  asRelationExists,
  firstHopPredicate,
  leafPath,
  singleTerminalSchemaId,
  terminalSchemaScope,
  withLeafPath
} from './leafPath';

const flatPredicate: QueryNode = {
  kind: 'predicate',
  path: [],
  fieldId: '_name',
  op: 'contains',
  value: 'api'
};

const traversalPredicate: QueryNode = {
  kind: 'predicate',
  path: [{ kind: 'forward', fieldId: 'system' }],
  fieldId: '_name',
  op: 'equals',
  value: 'Billing'
};

describe('leafPath', () => {
  it('reads the path off predicate / relationExists, empty otherwise', () => {
    expect(leafPath(flatPredicate)).toEqual([]);
    expect(leafPath(traversalPredicate)).toEqual([{ kind: 'forward', fieldId: 'system' }]);
    expect(leafPath({ kind: 'freeText', value: 'x' })).toEqual([]);
  });
});

describe('withLeafPath', () => {
  it('keeps field/op/value when repathing a predicate', () => {
    const next = withLeafPath(flatPredicate, [{ kind: 'forward', fieldId: 'system' }]);
    expect(next).toEqual({ ...flatPredicate, path: [{ kind: 'forward', fieldId: 'system' }] });
  });

  it('collapses an emptied relationExists back to a flat name predicate', () => {
    const exists: QueryNode = { kind: 'relationExists', path: [{ kind: 'forward', fieldId: 's' }] };
    expect(withLeafPath(exists, [])).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: '_name',
      op: 'contains',
      value: ''
    });
  });
});

describe('asRelationExists / asFieldPredicate', () => {
  it('round-trips a traversal predicate through relationExists', () => {
    const exists = asRelationExists(traversalPredicate);
    expect(exists).toEqual({ kind: 'relationExists', path: traversalPredicate.path });
    expect(asFieldPredicate(exists)).toEqual({
      kind: 'predicate',
      path: traversalPredicate.path,
      fieldId: '_name',
      op: 'contains',
      value: ''
    });
  });

  it('will not turn a flat predicate into relationExists', () => {
    expect(asRelationExists(flatPredicate)).toBe(flatPredicate);
  });
});

const schemas: EntitySchema[] = [
  {
    id: 'component',
    workspace: 't',
    name: 'Component',
    category: null,
    description: '',
    key_prefix: 'CMP',
    icon: 'box',
    color: '#000',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      {
        id: 'system',
        name: 'System',
        type: 'reference',
        schemaId: 'system',
        minCount: 0,
        maxCount: 1
      }
    ],
    templates: [],
    groups: []
  },
  {
    id: 'system',
    workspace: 't',
    name: 'System',
    category: null,
    description: '',
    key_prefix: 'SYS',
    icon: 'server',
    color: '#000',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [],
    templates: [],
    groups: []
  },
  {
    id: 'isolated',
    workspace: 't',
    name: 'Isolated',
    category: null,
    description: '',
    key_prefix: 'ISO',
    icon: 'circle',
    color: '#000',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [],
    templates: [],
    groups: []
  }
];

describe('terminalSchemaScope', () => {
  it('resolves the schema a forward hop lands on', () => {
    const scope = terminalSchemaScope([{ kind: 'forward', fieldId: 'system' }], {
      rootSchemaScope: ['component'],
      schemas,
      relationSchemas: []
    });
    expect(scope).toEqual(['system']);
    expect(singleTerminalSchemaId(scope)).toBe('system');
  });

  it('seeds a first-hop predicate from the root, or null when nothing is traversable', () => {
    expect(
      firstHopPredicate({ rootSchemaScope: ['component'], schemas, relationSchemas: [] })
    ).toEqual({
      kind: 'predicate',
      path: [{ kind: 'forward', fieldId: 'system' }],
      fieldId: '_name',
      op: 'contains',
      value: ''
    });
    expect(
      firstHopPredicate({ rootSchemaScope: ['isolated'], schemas, relationSchemas: [] })
    ).toBeNull();
  });

  it('returns any / null for an unresolvable path', () => {
    const scope = terminalSchemaScope([{ kind: 'forward', fieldId: 'nope' }], {
      rootSchemaScope: ['component'],
      schemas,
      relationSchemas: []
    });
    expect(singleTerminalSchemaId(scope)).toBeNull();
  });
});
