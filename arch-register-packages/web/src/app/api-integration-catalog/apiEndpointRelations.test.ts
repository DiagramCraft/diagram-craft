import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { groupByApiId, rankMostConsumedApis, resolveTypedRelationSchemaId } from './apiEndpointRelations';

const API_SCHEMA: EntitySchema = {
  id: 'api',
  name: 'API',
  fields: [
    {
      id: 'providers',
      name: 'Provided by',
      type: 'typedRelation',
      relationSchemaId: 'provides-api'
    },
    {
      id: 'consumers',
      name: 'Consumed by',
      type: 'typedRelation',
      relationSchemaId: 'consumes-api'
    },
    { id: 'api_version', name: 'API Version', type: 'text' }
  ]
} as unknown as EntitySchema;

const relation = (id: string, apiId: string, endpointId: string): RelationRecord =>
  ({
    _uid: id,
    _schema: { id: 'provides-api', name: 'Provides API' },
    _in: { id: endpointId, name: `Endpoint ${endpointId}` },
    _out: { id: apiId, name: `API ${apiId}` }
  }) as unknown as RelationRecord;

describe('resolveTypedRelationSchemaId', () => {
  it('resolves a typedRelation field to its relation-schema id', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'providers')).toBe('provides-api');
  });

  it('returns null for a non-typedRelation field', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'api_version')).toBeNull();
  });

  it('returns null for a missing field or schema', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'nonexistent')).toBeNull();
    expect(resolveTypedRelationSchemaId(undefined, 'providers')).toBeNull();
  });
});

describe('groupByApiId', () => {
  it('groups relations by their API (_out) endpoint', () => {
    const relations = [
      relation('r1', 'api-1', 'e1'),
      relation('r2', 'api-1', 'e2'),
      relation('r3', 'api-2', 'e3')
    ];
    const grouped = groupByApiId(relations);
    expect(grouped.get('api-1')).toHaveLength(2);
    expect(grouped.get('api-2')).toHaveLength(1);
    expect(grouped.get('api-3')).toBeUndefined();
  });

  it('returns an empty map for no relations', () => {
    expect(groupByApiId([]).size).toBe(0);
  });
});

const api = (id: string): EntityRecord => ({ _uid: id, _name: `API ${id}` }) as unknown as EntityRecord;

describe('rankMostConsumedApis', () => {
  it('returns an empty array for no apis', () => {
    expect(rankMostConsumedApis([], new Map(), 6)).toEqual([]);
  });

  it('ranks apis by consumer count, descending', () => {
    const apiA = api('a');
    const apiB = api('b');
    const consumersByApi = new Map([
      ['a', [relation('r1', 'a', 'e1')]],
      ['b', [relation('r2', 'b', 'e2'), relation('r3', 'b', 'e3')]]
    ]);
    expect(rankMostConsumedApis([apiA, apiB], consumersByApi, 6)).toEqual([apiB, apiA]);
  });

  it('treats an api absent from consumersByApi as having 0 consumers, sorting it last', () => {
    const apiA = api('a');
    const apiB = api('b');
    const consumersByApi = new Map([['a', [relation('r1', 'a', 'e1')]]]);
    expect(rankMostConsumedApis([apiA, apiB], consumersByApi, 6)).toEqual([apiA, apiB]);
  });

  it('caps the result at limit', () => {
    const apis = [api('a'), api('b'), api('c')];
    expect(rankMostConsumedApis(apis, new Map(), 2)).toHaveLength(2);
  });

  it('returns all apis when limit exceeds the input length', () => {
    const apis = [api('a'), api('b')];
    expect(rankMostConsumedApis(apis, new Map(), 6)).toHaveLength(2);
  });

  it('does not throw on ties and preserves both entries', () => {
    const apiA = api('a');
    const apiB = api('b');
    const result = rankMostConsumedApis([apiA, apiB], new Map(), 6);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([apiA, apiB]));
  });
});
