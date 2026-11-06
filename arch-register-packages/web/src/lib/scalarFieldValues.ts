import type { SchemaField } from '@arch-register/api-types/schemaContract';

const MULTI_VALUABLE_TYPES: ReadonlySet<SchemaField['type']> = new Set([
  'text',
  'longtext',
  'boolean',
  'date',
  'currency',
  'duration',
  'number',
  'select',
  'principal'
]);

export const isMultiValuedScalarField = (field: SchemaField): boolean =>
  MULTI_VALUABLE_TYPES.has(field.type) &&
  'maxCardinality' in field &&
  (field.maxCardinality === -1 || (field.maxCardinality ?? 1) > 1);

export const scalarValues = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null || value === '' ? [] : [value];

export const firstScalarValue = (value: unknown): unknown => scalarValues(value)[0];

export const createScalarItem = (type: SchemaField['type'], defaultCurrency?: string): unknown => {
  switch (type) {
    case 'boolean':
      return false;
    case 'currency':
      return { amount: undefined, currency: defaultCurrency ?? 'USD' };
    case 'duration':
      return { amount: undefined, unit: 'years' };
    default:
      return '';
  }
};
