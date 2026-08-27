import { describe, expect, it } from 'vitest';
import {
  isEntityRelationField,
  isRelationDerivedField,
  relationEndpointSchema,
  relationFieldInputSchema,
  type RelationField
} from './relationSchemaContract';

const baseField = {
  id: 'field-1',
  name: 'Field 1',
  requirementLevel: 'optional' as const
};

describe('entityRelationFieldSchema', () => {
  it('parses a valid entityRelation field', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'entityRelation',
      schemaId: 'entity-schema-1',
      minCount: 0,
      maxCount: -1
    });

    expect(result.success).toBe(true);
  });

  it('parses an entityRelation field with a bounded maxCount and predicate', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'entityRelation',
      predicate: 'carries',
      schemaId: 'entity-schema-1',
      minCount: 1,
      maxCount: 3
    });

    expect(result.success).toBe(true);
  });

  it('rejects an entityRelation field missing schemaId', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'entityRelation',
      minCount: 0,
      maxCount: -1
    });

    expect(result.success).toBe(false);
  });

  it('rejects an entityRelation field with a negative minCount', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'entityRelation',
      schemaId: 'entity-schema-1',
      minCount: -1,
      maxCount: -1
    });

    expect(result.success).toBe(false);
  });

  it('rejects an entityRelation field with an invalid predicate', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'entityRelation',
      predicate: 'not; valid!',
      schemaId: 'entity-schema-1',
      minCount: 0,
      maxCount: -1
    });

    expect(result.success).toBe(false);
  });
});

describe('relationEndpointSchema', () => {
  it('accepts an explicit, non-empty schemaIds array', () => {
    const result = relationEndpointSchema.safeParse({ schemaIds: ['entity-schema-1'] });

    expect(result.success).toBe(true);
  });

  it('accepts the "any" wildcard', () => {
    const result = relationEndpointSchema.safeParse({ schemaIds: 'any' });

    expect(result.success).toBe(true);
  });

  it('rejects an empty schemaIds array', () => {
    const result = relationEndpointSchema.safeParse({ schemaIds: [] });

    expect(result.success).toBe(false);
  });

  it('rejects a wildcard-like string other than "any"', () => {
    const result = relationEndpointSchema.safeParse({ schemaIds: 'all' });

    expect(result.success).toBe(false);
  });
});

describe('derivedRelationFieldInputSchema', () => {
  it('parses a valid derived relation field', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'derived',
      requirementLevel: 'optional',
      expression: "relation._in.residency == relation._out.residency ? 'no' : 'yes'",
      resultType: 'text'
    });
    expect(result.success).toBe(true);
  });

  it('requires enumId for a derived select result', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'derived',
      requirementLevel: 'optional',
      expression: 'relation.region',
      resultType: 'select'
    });
    expect(result.success).toBe(false);
  });

  it('rejects enumId on a non-select derived result', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'derived',
      requirementLevel: 'optional',
      expression: 'relation.region',
      resultType: 'text',
      enumId: 'regions'
    });
    expect(result.success).toBe(false);
  });

  it('rejects a required derived field', () => {
    const result = relationFieldInputSchema.safeParse({
      ...baseField,
      type: 'derived',
      requirementLevel: 'required',
      expression: 'relation.region',
      resultType: 'text'
    });
    expect(result.success).toBe(false);
  });

  it('is recognised by isRelationDerivedField', () => {
    const derived: RelationField = {
      ...baseField,
      type: 'derived',
      requirementLevel: 'optional',
      expression: 'relation.region',
      resultType: 'text'
    };
    expect(isRelationDerivedField(derived)).toBe(true);
    expect(isRelationDerivedField({ ...baseField, type: 'text' } as RelationField)).toBe(false);
  });
});

describe('isEntityRelationField', () => {
  const entityRelationField: RelationField = {
    ...baseField,
    type: 'entityRelation',
    schemaId: 'entity-schema-1',
    minCount: 0,
    maxCount: -1
  };
  const textField: RelationField = { ...baseField, type: 'text' };

  it('matches only entityRelation fields', () => {
    expect(isEntityRelationField(entityRelationField)).toBe(true);
    expect(isEntityRelationField(textField)).toBe(false);
  });
});
