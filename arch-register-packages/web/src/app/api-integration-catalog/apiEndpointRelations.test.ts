import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { groupByApiId, resolveTypedRelationSchemaId } from './apiEndpointRelations';

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
