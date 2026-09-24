import { describe, expect, it } from 'vitest';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  changeTypedRelationListField,
  getTypedRelationAttributeFields
} from './entityDrawerSettingsHelpers';

const typedRelationField = {
  id: 'mitigating_controls',
  name: 'Mitigated by',
  type: 'typedRelation',
  relationSchemaId: 'risk-control',
  direction: 'in'
} as unknown as TypedRelationField;

const relationSchemas: RelationSchema[] = [
  {
    id: 'risk-control',
    fields: [
      { id: 'coverage', name: 'Coverage', type: 'number', archived: false },
      { id: 'effectiveness', name: 'Effectiveness', type: 'select' },
      { id: 'retired_note', name: 'Retired note', type: 'text', archived: true }
    ]
  } as unknown as RelationSchema,
  {
    id: 'other-relation',
    fields: [{ id: 'confidence', name: 'Confidence', type: 'number' }]
  } as unknown as RelationSchema
];

describe('entity drawer settings helpers', () => {
  it('gets active attribute choices from the selected typed relation field relation schema', () => {
    const fields = getTypedRelationAttributeFields(typedRelationField, relationSchemas);

    expect(fields.map(field => field.id)).toEqual(['coverage', 'effectiveness']);
    expect(fields.map(field => field.name)).toEqual(['Coverage', 'Effectiveness']);
  });

  it('returns no attribute choices when the typed relation schema is missing', () => {
    expect(
      getTypedRelationAttributeFields({ relationSchemaId: 'missing' }, relationSchemas)
    ).toEqual([]);
  });

  it('clears configured attributes when a typed relation list changes fields', () => {
    const next = changeTypedRelationListField(
      {
        kind: 'typed-relation-list',
        fieldId: 'mitigating_controls',
        attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness', label: 'Effect' }]
      },
      'related_projects'
    );

    expect(next).toEqual({
      kind: 'typed-relation-list',
      fieldId: 'related_projects',
      attributes: []
    });
  });
});
