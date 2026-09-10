import { describe, expect, it } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  PATH_WALKER_PROJECTION_ALIAS,
  buildHopColumnQuery,
  decodeHopColumnNodes,
  hopDirectionGlyph,
  hopOptionsFrom,
  parsePathWalkerConfig,
  pathStepKey,
  pathWalkerHops
} from './pathWalkerViewState';

const makeRelation = (
  id: string,
  name: string,
  inSchemaIds: string[] | 'any',
  outSchemaIds: string[] | 'any'
) =>
  ({
    id,
    workspace: 'workspace',
    name,
    category: null,
    description: '',
    in: { schemaIds: inSchemaIds },
    out: { schemaIds: outSchemaIds },
    fields: [],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    unique_endpoint_pair: false,
    version: 1,
    created_at: '',
    updated_at: ''
  }) as RelationSchema;

const relations = [
  makeRelation(
    'objective-supports-capability',
    'Supports capability',
    ['objective'],
    ['capability']
  ),
  makeRelation('capability-supports-app', 'Supports application', ['capability'], ['application'])
];
const schemas = [
  { id: 'objective', name: 'Objective', fields: [], groups: [] },
  { id: 'capability', name: 'Capability', fields: [], groups: [] },
  { id: 'application', name: 'Application', fields: [], groups: [] }
] as unknown as EntitySchema[];

const supportsHop = {
  kind: 'unboundTypedRelation' as const,
  relationSchemaId: 'objective-supports-capability',
  direction: 'in' as const
};

describe('parsePathWalkerConfig / pathWalkerHops', () => {
  it('accepts an empty or absent config and a remembered hop list', () => {
    expect(pathWalkerHops(null)).toEqual([]);
    expect(pathWalkerHops({})).toEqual([]);
    expect(parsePathWalkerConfig({ hops: [supportsHop] })?.hops).toHaveLength(1);
    expect(pathWalkerHops({ hops: [supportsHop] })).toHaveLength(1);
  });
});

describe('hopOptionsFrom', () => {
  it('lists both traversal directions available from an entity schema, de-duplicated', () => {
    const fromObjective = hopOptionsFrom({
      schemaId: 'objective',
      schemas,
      relationSchemas: relations
    });
    expect(fromObjective.map(o => o.label)).toContain('Supports capability');

    const fromCapability = hopOptionsFrom({
      schemaId: 'capability',
      schemas,
      relationSchemas: relations
    });
    // reachable both back to objectives and out to applications
    expect(fromCapability.map(o => o.label).sort()).toEqual(
      ['Supports application', 'Supports capability'].sort()
    );
  });
});

describe('hopDirectionGlyph', () => {
  it('maps step kind/direction to the hop-editor arrow glyph', () => {
    expect(hopDirectionGlyph({ kind: 'forward', fieldId: 'x' })).toBe('→');
    expect(hopDirectionGlyph({ kind: 'backward', fieldId: 'x', ownerSchemaId: 's' })).toBe('←');
    expect(hopDirectionGlyph(supportsHop)).toBe('→');
    expect(hopDirectionGlyph({ ...supportsHop, direction: 'out' })).toBe('←');
  });
});

describe('buildHopColumnQuery', () => {
  it('roots the query at a single entity and attaches a single-hop includePath projection', () => {
    const query = buildHopColumnQuery('objective-1', supportsHop);
    expect(query.root).toEqual({
      kind: 'predicate',
      path: [],
      fieldId: '_id',
      op: 'in',
      value: ['objective-1']
    });
    expect(query.projections).toEqual([
      {
        path: [supportsHop],
        fieldId: '_id',
        alias: PATH_WALKER_PROJECTION_ALIAS,
        includePath: true
      }
    ]);
  });

  it('accepts several source ids for the batched fan-out count query', () => {
    const query = buildHopColumnQuery(['a', 'b', 'c'], supportsHop);
    expect(query.root).toMatchObject({ op: 'in', value: ['a', 'b', 'c'] });
  });
});

describe('decodeHopColumnNodes', () => {
  it('returns distinct leaf nodes sorted by name and is empty for a broken chain', () => {
    const projection = [
      [{ id: 'cap-b', name: 'Billing', schemaId: 'capability' }],
      [{ id: 'cap-a', name: 'Auth', schemaId: 'capability' }],
      [{ id: 'cap-a', name: 'Auth', schemaId: 'capability' }]
    ];
    expect(decodeHopColumnNodes(projection).map(n => n.id)).toEqual(['cap-a', 'cap-b']);
    expect(decodeHopColumnNodes(undefined)).toEqual([]);
  });
});

describe('pathStepKey re-export', () => {
  it('is stable per step identity', () => {
    expect(pathStepKey(supportsHop)).toBe('unboundTypedRelation:objective-supports-capability:in');
  });
});
