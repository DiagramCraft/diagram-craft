import { describe, expect, it } from 'vitest';
import {
  isReferenceOrContainmentField,
  isRelationLikeField,
  isTypedRelationField,
  schemaFieldInputSchema,
  type SchemaField
} from './schemaContract';

const baseField = {
  id: 'field-1',
  name: 'Field 1',
  requirementLevel: 'optional' as const
};

describe('typedRelationFieldSchema', () => {
  it('parses a valid typedRelation field', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'typedRelation',
      relationSchemaId: 'rel-schema-1',
      direction: 'out'
    });

    expect(result.success).toBe(true);
  });

  it('rejects a typedRelation field missing relationSchemaId', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'typedRelation',
      direction: 'out'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a typedRelation field with an invalid direction', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'typedRelation',
      relationSchemaId: 'rel-schema-1',
      direction: 'sideways'
    });

    expect(result.success).toBe(false);
  });
});

describe('currency fields', () => {
  it('parses a currency field definition', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'currency'
    });

    expect(result.success).toBe(true);
  });
});

describe('date reminder configuration', () => {
  it('parses an enabled date reminder configuration', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'date',
      reminder: { enabled: true, approachingDays: [3, 7], overdueDays: [1] }
    });

    expect(result.success).toBe(true);
  });

  it('allows date fields without reminder configuration', () => {
    const result = schemaFieldInputSchema.safeParse({ ...baseField, type: 'date' });

    expect(result.success).toBe(true);
  });

  it('rejects negative or fractional reminder windows', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'date',
      reminder: { enabled: true, approachingDays: [-1], overdueDays: [1.5] }
    });

    expect(result.success).toBe(false);
  });
});

describe('relation-like field predicates', () => {
  const referenceField: SchemaField = {
    ...baseField,
    type: 'reference',
    schemaId: 'schema-1',
    minCount: 0,
    maxCount: -1
  };
  const containmentField: SchemaField = {
    ...baseField,
    type: 'containment',
    schemaId: 'schema-1',
    minCount: 0,
    maxCount: 1
  };
  const typedRelationField: SchemaField = {
    ...baseField,
    type: 'typedRelation',
    relationSchemaId: 'rel-schema-1',
    direction: 'in'
  };
  const textField: SchemaField = { ...baseField, type: 'text' };

  it('isReferenceOrContainmentField matches only reference/containment', () => {
    expect(isReferenceOrContainmentField(referenceField)).toBe(true);
    expect(isReferenceOrContainmentField(containmentField)).toBe(true);
    expect(isReferenceOrContainmentField(typedRelationField)).toBe(false);
    expect(isReferenceOrContainmentField(textField)).toBe(false);
  });

  it('isTypedRelationField matches only typedRelation', () => {
    expect(isTypedRelationField(typedRelationField)).toBe(true);
    expect(isTypedRelationField(referenceField)).toBe(false);
    expect(isTypedRelationField(textField)).toBe(false);
  });

  it('isRelationLikeField matches reference/containment/typedRelation', () => {
    expect(isRelationLikeField(referenceField)).toBe(true);
    expect(isRelationLikeField(containmentField)).toBe(true);
    expect(isRelationLikeField(typedRelationField)).toBe(true);
    expect(isRelationLikeField(textField)).toBe(false);
  });
});
