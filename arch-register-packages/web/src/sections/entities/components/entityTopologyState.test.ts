import { describe, expect, it } from 'vitest';
import { groupRelationsByField } from './entityTopologyState';
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
