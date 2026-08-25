import type { SchemaField } from '@arch-register/api-types/schemaContract';

export const isMultiValuedScalarField = (field: SchemaField): boolean =>
  (() => {
    if (
      field.type !== 'text' &&
      field.type !== 'longtext' &&
      field.type !== 'boolean' &&
      field.type !== 'date' &&
      field.type !== 'currency' &&
      field.type !== 'number' &&
      field.type !== 'select' &&
      field.type !== 'principal'
    ) {
      return false;
    }
    return field.maxCardinality === -1 || (field.maxCardinality ?? 1) > 1;
  })();

export const scalarValues = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value == null || value === '' ? [] : [value];

export const firstScalarValue = (value: unknown): unknown => scalarValues(value)[0];
