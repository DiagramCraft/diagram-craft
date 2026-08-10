import { describe, expect, it } from 'vitest';
import { groupRelationsByField, groupRelationsByRelationSchema } from './entityTopologyState';
import type { Relation } from '../types/entityDetailTypes';

const relation = (fieldName: string, entityId: string, fieldPredicate?: string): Relation => ({
  entityId,
  publicId: entityId.toUpperCase(),
  entitySlug: entityId,
  entityName: entityId,
  entitySchemaId: 'service',
  fieldName,
  fieldPredicate,
  kind: 'reference'
});

const typedRelation = (
  fieldName: string,
  entityId: string,
  relationSchemaId: string,
  relationId: string
): Relation => ({
  entityId,
  publicId: entityId.toUpperCase(),
  entitySlug: entityId,
  entityName: entityId,
  entitySchemaId: 'service',
  fieldName,
  kind: 'typed',
  relationId,
  relationSchemaId
});

describe('groupRelationsByField', () => {
  it('groups interleaved relations in first-seen field order', () => {
    const first = relation('dependsOn', 'one');
    const second = relation('ownedBy', 'two');
    const third = relation('dependsOn', 'three');

    expect(groupRelationsByField([first, second, third])).toEqual([
      { key: 'dependsOn', label: 'dependsOn', relations: [first, third] },
      { key: 'ownedBy', label: 'ownedBy', relations: [second] }
    ]);
  });

  it('uses a predicate as the group label when one is present', () => {
    const withPredicate = relation('dependsOn', 'one', 'Requires');
    expect(groupRelationsByField([withPredicate])).toEqual([
      { key: 'dependsOn', label: 'Requires', relations: [withPredicate] }
    ]);
  });

  it('returns no groups for an empty relation list', () => {
    expect(groupRelationsByField([])).toEqual([]);
  });
});

describe('groupRelationsByRelationSchema', () => {
  it('groups typed relations by relationSchemaId rather than fieldName', () => {
    const first = typedRelation('dependsOn', 'one', 'schema-a', 'rel-1');
    const second = typedRelation('supports', 'two', 'schema-a', 'rel-2');
    const third = typedRelation('ownedBy', 'three', 'schema-b', 'rel-3');

    expect(groupRelationsByRelationSchema([first, second, third])).toEqual([
      { key: 'schema-a', label: 'dependsOn', relations: [first, second] },
      { key: 'schema-b', label: 'ownedBy', relations: [third] }
    ]);
  });

  it('keeps API providers and consumers in separate topology groups', () => {
    const provider = typedRelation('provides_apis', 'api-one', 'provides-api', 'rel-1');
    const consumer = typedRelation('consumes_apis', 'api-two', 'consumes-api', 'rel-2');

    expect(groupRelationsByRelationSchema([provider, consumer])).toEqual([
      { key: 'provides-api', label: 'provides_apis', relations: [provider] },
      { key: 'consumes-api', label: 'consumes_apis', relations: [consumer] }
    ]);
  });

  it('falls back to fieldName when relationSchemaId is absent', () => {
    const withoutSchema = relation('dependsOn', 'one');
    expect(groupRelationsByRelationSchema([withoutSchema])).toEqual([
      { key: 'dependsOn', label: 'dependsOn', relations: [withoutSchema] }
    ]);
  });

  it('returns no groups for an empty relation list', () => {
    expect(groupRelationsByRelationSchema([])).toEqual([]);
  });
});
