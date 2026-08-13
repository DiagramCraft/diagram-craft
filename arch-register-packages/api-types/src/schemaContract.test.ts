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

describe('scalar field cardinality', () => {
  it('accepts ordered multi-valued scalar definitions', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'select',
      enumId: 'enum-1',
      minCardinality: 1,
      maxCardinality: -1
    });

    expect(result.success).toBe(true);
  });

  it('rejects a scalar cardinality range where min exceeds max', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'text',
      minCardinality: 3,
      maxCardinality: 2
    });

    expect(result.success).toBe(false);
  });
});

describe('date fields', () => {
  it('parses date fields without embedded reminder configuration', () => {
    const result = schemaFieldInputSchema.safeParse({ ...baseField, type: 'date' });

    expect(result.success).toBe(true);
  });

  it('does not retain the removed embedded reminder configuration', () => {
    const result = schemaFieldInputSchema.safeParse({
      ...baseField,
      type: 'date',
      reminder: { enabled: true, approachingDays: [3], overdueDays: [1] }
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('reminder');
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
