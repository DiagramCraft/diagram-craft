import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import {
  buildDraftEntityRecord,
  buildReferenceOptions,
  computeChangedLabels,
  draftIdFromKey,
  draftKey,
  isDraftKey,
  isRelationKey,
  relationIdFromKey,
  relationKey,
  type DraftEntity
} from './planChangeDraft';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'tier', name: 'Tier', type: 'text' },
    { id: 'depends', name: 'Depends on', type: 'reference', schemaId: 'service' }
  ]
} as unknown as EntitySchema;

describe('member keys', () => {
  it('round-trips draft and relation ids', () => {
    expect(draftIdFromKey(draftKey('abc'))).toBe('abc');
    expect(relationIdFromKey(relationKey('r1'))).toBe('r1');
    expect(isDraftKey(draftKey('abc'))).toBe(true);
    expect(isRelationKey(relationKey('r1'))).toBe(true);
    expect(isDraftKey('plain-entity-id')).toBe(false);
    expect(isRelationKey('plain-entity-id')).toBe(false);
  });
});

describe('computeChangedLabels', () => {
  const entity = { _name: 'Billing', _description: '', _owner: { id: 't1' }, tier: 'gold' };

  it('lists only the fields that differ, skipping relation fields', () => {
    const labels = computeChangedLabels(entity, schema, {
      _name: 'Billing v2',
      _description: '',
      _owner: 't1',
      tier: 'silver',
      depends: ['x']
    });
    expect(labels).toEqual(['Name', 'Tier']);
  });

  it('returns nothing when the plan equals the current state', () => {
    expect(
      computeChangedLabels(entity, schema, {
        _name: 'Billing',
        _description: '',
        _owner: 't1',
        tier: 'gold'
      })
    ).toEqual([]);
  });
});

describe('buildDraftEntityRecord', () => {
  it('maps a draft state onto an entity record', () => {
    const record = buildDraftEntityRecord(
      'd1',
      { schema_id: 'service', name: 'New', slug: 'new', owner: 't1', data: { tier: 'gold' } },
      [schema],
      'p1'
    );
    expect(record._uid).toBe('d1');
    expect(record._schema).toEqual({ id: 'service', name: 'Service' });
    expect(record._owner).toEqual({ id: 't1', name: 't1' });
    expect(record._lifecycle).toBeNull();
    expect(record._projectId).toBe('p1');
    expect((record as Record<string, unknown>).tier).toBe('gold');
  });
});

describe('buildReferenceOptions', () => {
  it('groups project entities and drafts by schema, skipping entities without one', () => {
    const projectEntities = [
      {
        entity_id: 'e1',
        entity_name: 'A',
        entity_slug: 'a',
        entity_schema: { id: 'service', name: 'Service' }
      },
      { entity_id: 'e2', entity_name: 'B', entity_slug: 'b', entity_schema: null }
    ] as unknown as ProjectEntity[];
    const drafts = [
      {
        draftId: 'd1',
        state: {},
        entity: { _name: 'C', _slug: 'c', _schema: { id: 'service', name: 'Service' } }
      }
    ] as unknown as DraftEntity[];

    const options = buildReferenceOptions(projectEntities, drafts, 'p1');
    expect(Object.keys(options)).toEqual(['service']);
    expect(options.service!.map(e => e._uid)).toEqual(['e1', 'd1']);
  });
});
