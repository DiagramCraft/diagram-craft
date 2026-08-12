import type { SchemaField } from '@arch-register/api-types/schemaContract';

export type ScalarCardinalityField = Extract<
  SchemaField,
  {
    type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency' | 'number' | 'select';
  }
>;

export const isScalarCardinalityField = (field: SchemaField): field is ScalarCardinalityField =>
  ['text', 'longtext', 'boolean', 'date', 'currency', 'number', 'select'].includes(field.type);

export const scalarCardinalityPatchForRequirement = (
  field: ScalarCardinalityField,
  requirementLevel: NonNullable<SchemaField['requirementLevel']>
): Partial<SchemaField> => {
  const minCardinality =
    requirementLevel === 'required' ? Math.max(field.minCardinality ?? 0, 1) : 0;
  const maxCardinality = field.maxCardinality;

  return {
    requirementLevel,
    minCardinality,
    ...(requirementLevel === 'required' &&
    maxCardinality !== undefined &&
    maxCardinality !== -1 &&
    maxCardinality < minCardinality
      ? { maxCardinality: minCardinality }
      : {})
  };
};

export const scalarCardinalityPatchForMin = (
  field: ScalarCardinalityField,
  minCardinality: number
): Partial<SchemaField> => ({
  minCardinality,
  ...(minCardinality > 0
    ? { requirementLevel: 'required' }
    : field.requirementLevel === 'required'
      ? { requirementLevel: 'optional' }
      : {})
});
