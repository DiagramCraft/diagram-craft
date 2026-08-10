import { describe, expect, it } from 'vitest';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import {
  buildRelationFieldMigrations,
  createRelationFieldForType,
  firstRemainingRelationSchemaId,
  setEndpointSchemaIds
} from './relationSchemaSettingsHelpers';

const field = (id: string): RelationField => ({
  id,
  name: id,
  type: 'text'
});

describe('relation schema settings helpers', () => {
  it('creates relation field defaults for select and entity relation fields', () => {
    const original = field('kind');

    expect(createRelationFieldForType(original, 'select', 'enum-1')).toEqual({
      id: 'kind',
      name: 'kind',
      type: 'select',
      enumId: 'enum-1'
    });
    expect(createRelationFieldForType(original, 'entityRelation')).toEqual({
      id: 'kind',
      name: 'kind',
      type: 'entityRelation',
      predicate: '',
      schemaId: '',
      minCount: 0,
      maxCount: -1
    });
  });

  it('preserves endpoint shape while switching between any and selected schemas', () => {
    const endpoint = { schemaIds: ['schema-1'] };
    expect(setEndpointSchemaIds(endpoint, 'any')).toEqual({ schemaIds: 'any' });
    expect(setEndpointSchemaIds({ schemaIds: 'any' }, ['schema-2'])).toEqual({
      schemaIds: ['schema-2']
    });
  });

  it('selects the first remaining relation schema after deletion', () => {
    expect(
      firstRemainingRelationSchemaId([{ id: 'deleted' }, { id: 'remaining' }], 'deleted')
    ).toBe('remaining');
    expect(firstRemainingRelationSchemaId([{ id: 'deleted' }], 'deleted')).toBe('');
  });

  it('serializes relation field migration choices', () => {
    expect(
      buildRelationFieldMigrations(
        [{ fieldId: 'removed', fieldName: 'Removed', kind: 'removed', entityCount: 1 }],
        { removed: 'archive' }
      )
    ).toEqual({ removed: { action: 'archive' } });
  });
});
