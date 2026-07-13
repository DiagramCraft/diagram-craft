import { describe, expect, it } from 'vitest';
import { buildEntityRefLookup } from './entityDetailHelpers';
import type { EntityRelations } from '@arch-register/api-types/entityContract';

const relation = (entityId: string, entityName: string, entitySchemaId = 'service') => ({
  entityId,
  publicId: entityId.toUpperCase(),
  entitySlug: entityName.toLowerCase().replace(/\s+/g, '-'),
  entityName,
  entitySchemaId,
  fieldName: 'dependsOn',
  kind: 'reference' as const
});

describe('buildEntityRefLookup', () => {
  it('maps outgoing relations to entity summaries used by reference inputs', () => {
    const lookup = buildEntityRefLookup({
      outgoing: [relation('entity-1', 'Entity One', 'application')],
      incoming: []
    });

    expect(lookup.get('entity-1')).toMatchObject({
      _uid: 'entity-1',
      _publicId: 'ENTITY-1',
      _schema: { id: 'application', name: '' },
      _name: 'Entity One',
      _slug: 'entity-one',
      _links: [],
      canView: true,
      canEdit: false,
      canDelete: false,
      canAdmin: false,
      canCreateChild: false
    });
  });

  it('ignores incoming relations and lets the last outgoing duplicate win', () => {
    const incoming = relation('incoming-only', 'Incoming Only');
    const first = relation('duplicate', 'First');
    const last = relation('duplicate', 'Last');
    const relations: EntityRelations = {
      outgoing: [first, last],
      incoming: [incoming]
    };

    const lookup = buildEntityRefLookup(relations);

    expect(lookup.has('incoming-only')).toBe(false);
    expect(lookup.get('duplicate')?._name).toBe('Last');
  });

  it('returns an empty lookup when there are no outgoing relations', () => {
    expect(
      buildEntityRefLookup({ outgoing: [], incoming: [relation('incoming', 'Incoming')] })
    ).toEqual(new Map());
  });
});
