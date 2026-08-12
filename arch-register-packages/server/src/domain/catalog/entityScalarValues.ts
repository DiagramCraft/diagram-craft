import type { CurrencyValue } from '@arch-register/api-types/common';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { httpAssert } from '../../utils/httpAssert';
import { parseCurrencyValue } from '../../utils/currencyValue';

export type ScalarSchemaField = Extract<
  SchemaField,
  {
    type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency' | 'number' | 'select';
  }
>;

export type EntityScalarValueOptions = {
  supportedCurrencies?: ReadonlySet<string>;
  validateMissing?: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const scalarFieldMinCardinality = (field: ScalarSchemaField): number =>
  Math.max(field.minCardinality ?? 0, field.requirementLevel === 'required' ? 1 : 0);

export const scalarFieldMaxCardinality = (field: ScalarSchemaField): number =>
  field.maxCardinality ?? 1;

export const isScalarSchemaField = (field: SchemaField): field is ScalarSchemaField =>
  field.type === 'text' ||
  field.type === 'longtext' ||
  field.type === 'boolean' ||
  field.type === 'date' ||
  field.type === 'currency' ||
  field.type === 'number' ||
  field.type === 'select';

export const isMultiValuedScalarField = (field: SchemaField): boolean =>
  isScalarSchemaField(field) &&
  (scalarFieldMaxCardinality(field) === -1 || scalarFieldMaxCardinality(field) > 1);

const isEmptyScalarValue = (value: unknown): boolean =>
  value == null || (typeof value === 'string' && value.trim() === '');

const scalarValues = (field: ScalarSchemaField, value: unknown): unknown[] => {
  if (isMultiValuedScalarField(field)) {
    if (value == null || value === '') return [];
    return Array.isArray(value) ? value : [value];
  }

  if (Array.isArray(value)) {
    httpAssert.true(value.length <= 1, {
      status: 400,
      message: `${field.name} is a single-valued field`
    });
    return value;
  }
  return isEmptyScalarValue(value) ? [] : [value];
};

const validateDate = (field: ScalarSchemaField, value: unknown): string => {
  const dateValue = typeof value === 'string' ? value : '';
  httpAssert.true(typeof value === 'string' && DATE_PATTERN.test(value), {
    status: 400,
    message: `${field.name} must contain dates in YYYY-MM-DD format`
  });
  const parsed = new Date(`${dateValue}T00:00:00.000Z`);
  httpAssert.true(
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateValue,
    {
      status: 400,
      message: `${field.name} contains an invalid date`
    }
  );
  return dateValue;
};

const validateNumber = (field: Extract<ScalarSchemaField, { type: 'number' }>, value: unknown) => {
  const numberValue = typeof value === 'number' ? value : Number.NaN;
  httpAssert.true(typeof value === 'number' && Number.isInteger(value), {
    status: 400,
    message: `${field.name} must contain whole numbers`
  });
  httpAssert.true(field.min === undefined || numberValue >= field.min, {
    status: 400,
    message: `${field.name} values must be at least ${field.min}`
  });
  httpAssert.true(field.max === undefined || numberValue <= field.max, {
    status: 400,
    message: `${field.name} values must be at most ${field.max}`
  });
  return numberValue;
};

const validateCurrency = (
  field: ScalarSchemaField,
  value: unknown,
  supportedCurrencies?: ReadonlySet<string>
): CurrencyValue => {
  const parsed = parseCurrencyValue(value);
  httpAssert.present(parsed, {
    status: 400,
    message: `${field.name} must contain an amount and three-letter currency code`
  });
  httpAssert.true(supportedCurrencies === undefined || supportedCurrencies.has(parsed.currency), {
    status: 400,
    message: `${field.name} uses unsupported currency '${parsed.currency}'`
  });
  return parsed;
};

const normalizeScalarItem = (
  field: ScalarSchemaField,
  value: unknown,
  supportedCurrencies?: ReadonlySet<string>
): unknown => {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'select':
      httpAssert.true(typeof value === 'string', {
        status: 400,
        message: `${field.name} must contain strings`
      });
      return value;
    case 'boolean':
      httpAssert.true(typeof value === 'boolean', {
        status: 400,
        message: `${field.name} must contain boolean values`
      });
      return value;
    case 'date':
      return validateDate(field, value);
    case 'number':
      return validateNumber(field, value);
    case 'currency':
      return validateCurrency(field, value, supportedCurrencies);
  }
};

const normalizeFieldValues = (
  field: ScalarSchemaField,
  rawValue: unknown,
  supportedCurrencies?: ReadonlySet<string>
): unknown => {
  const values = scalarValues(field, rawValue);
  const normalizedValues = values
    .filter(value => !isEmptyScalarValue(value))
    .map(value => normalizeScalarItem(field, value, supportedCurrencies));

  const min = scalarFieldMinCardinality(field);
  const max = scalarFieldMaxCardinality(field);
  httpAssert.true(normalizedValues.length >= min, {
    status: 400,
    message: `${field.name} requires at least ${min} value${min === 1 ? '' : 's'}`
  });
  httpAssert.true(max === -1 || normalizedValues.length <= max, {
    status: 400,
    message: `${field.name} allows at most ${max} value${max === 1 ? '' : 's'}`
  });

  return isMultiValuedScalarField(field)
    ? normalizedValues
    : normalizedValues.length === 0
      ? undefined
      : normalizedValues[0];
};

/**
 * Normalizes and validates the declared scalar fields in an entity data object.
 * Unknown fields and relation fields are intentionally preserved for their existing validators.
 */
export const normalizeEntityScalarFields = ({
  schemaFields,
  fields,
  supportedCurrencies,
  validateMissing = true
}: {
  schemaFields: readonly SchemaField[];
  fields: Record<string, unknown>;
} & EntityScalarValueOptions): Record<string, unknown> => {
  const normalized = { ...fields };
  for (const field of schemaFields) {
    if (
      !['text', 'longtext', 'boolean', 'date', 'currency', 'number', 'select'].includes(field.type)
    )
      continue;
    if (!Object.hasOwn(normalized, field.id)) {
      if (validateMissing) {
        const min = scalarFieldMinCardinality(field as ScalarSchemaField);
        httpAssert.true(min === 0, {
          status: 400,
          message: `${field.name} requires at least ${min} value${min === 1 ? '' : 's'}`
        });
      }
      continue;
    }

    const value = normalizeFieldValues(
      field as ScalarSchemaField,
      normalized[field.id],
      supportedCurrencies
    );
    if (value === undefined) delete normalized[field.id];
    else normalized[field.id] = value;
  }
  return normalized;
};

/** Converts a value between the scalar and multi-valued storage shapes during schema changes. */
export const convertScalarFieldCardinality = (
  field: ScalarSchemaField,
  value: unknown,
  supportedCurrencies?: ReadonlySet<string>
): unknown => {
  const normalized = normalizeFieldValues(field, value, supportedCurrencies);
  return normalized;
};
