import type { CurrencyValue } from '@arch-register/api-types/common';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { httpAssert } from '../../utils/httpAssert';
import { parseCurrencyValue } from '../../utils/currencyValue';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';

export type ScalarSchemaField = Extract<
  SchemaField,
  {
    type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency' | 'number' | 'select' | 'principal';
  }
>;

export type EntityScalarValueOptions = {
  supportedCurrencies?: ReadonlySet<string>;
  validateMissing?: boolean;
  enumDefinitions?: readonly WorkspaceEnumDbResult[];
  previousFields?: Record<string, unknown>;
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
  field.type === 'select' ||
  field.type === 'principal';

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

/**
 * Validates only the shape of a principal reference (`principal_type`/`principal_id`), matching
 * the existing entity-grant precedent (`buildEntityGrantInputs`) which also does not resolve the
 * id against real user/team records.
 */
const validatePrincipal = (
  field: ScalarSchemaField,
  value: unknown
): { principal_type: 'user' | 'team'; principal_id: string } => {
  httpAssert.true(
    typeof value === 'object' &&
      value !== null &&
      ((value as Record<string, unknown>).principal_type === 'user' ||
        (value as Record<string, unknown>).principal_type === 'team') &&
      typeof (value as Record<string, unknown>).principal_id === 'string' &&
      (value as Record<string, unknown>).principal_id !== '',
    {
      status: 400,
      message: `${field.name} must contain a { principal_type: 'user' | 'team', principal_id } reference`
    }
  );
  const principal = value as { principal_type: 'user' | 'team'; principal_id: string };
  return { principal_type: principal.principal_type, principal_id: principal.principal_id };
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
    case 'principal':
      return validatePrincipal(field, value);
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

type SelectEnumField = {
  id: string;
  name: string;
  type: 'select';
  enumId?: string;
};

const asValueList = (value: unknown): unknown[] => {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Validates select values against workspace enums without assigning meaning to enum names or
 * categories. Existing unknown/retired values are allowed when they are preserved from the
 * previous record, keeping historical data editable through unrelated changes.
 */
export const validateSelectEnumValues = ({
  schemaFields,
  fields,
  enumDefinitions,
  previousFields = {}
}: {
  schemaFields: readonly SelectEnumField[];
  fields: Record<string, unknown>;
  enumDefinitions?: readonly WorkspaceEnumDbResult[];
  previousFields?: Record<string, unknown>;
}) => {
  if (enumDefinitions === undefined) return;

  const enumById = new Map(enumDefinitions.map(enumeration => [enumeration.id, enumeration]));
  for (const field of schemaFields) {
    if (field.type !== 'select' || !Object.hasOwn(fields, field.id)) continue;
    const enumId = field.enumId;
    httpAssert.string(enumId, {
      status: 409,
      message: `Select field '${field.name}' does not reference an enum`
    });
    const enumeration = enumById.get(enumId);
    httpAssert.present(enumeration, {
      status: 409,
      message: `Select field '${field.name}' references unknown enum '${enumId}'`
    });
    const previousValues = new Set(asValueList(previousFields[field.id]));
    const optionsByValue = new Map(enumeration.options.map(option => [option.value, option]));

    for (const value of asValueList(fields[field.id])) {
      httpAssert.string(value, {
        status: 400,
        message: `${field.name} must contain strings`
      });
      const option = optionsByValue.get(value);
      if (option === undefined) {
        httpAssert.true(previousValues.has(value), {
          status: 400,
          message: `${field.name} contains unknown enum option '${value}'`
        });
        continue;
      }
      if (option.retired === true) {
        httpAssert.true(previousValues.has(value), {
          status: 400,
          message: `${field.name} cannot be changed to retired enum option '${value}'`
        });
      }
    }
  }
};

/**
 * Normalizes and validates the declared scalar fields in an entity data object.
 * Unknown fields and relation fields are intentionally preserved for their existing validators.
 */
export const normalizeEntityScalarFields = ({
  schemaFields,
  fields,
  supportedCurrencies,
  validateMissing = true,
  enumDefinitions,
  previousFields
}: {
  schemaFields: readonly SchemaField[];
  fields: Record<string, unknown>;
} & EntityScalarValueOptions): Record<string, unknown> => {
  const normalized = { ...fields };
  for (const field of schemaFields) {
    if (
      ![
        'text',
        'longtext',
        'boolean',
        'date',
        'currency',
        'number',
        'select',
        'principal'
      ].includes(field.type)
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
  validateSelectEnumValues({
    schemaFields: schemaFields.filter(
      (field): field is SchemaField & SelectEnumField => field.type === 'select'
    ),
    fields: normalized,
    enumDefinitions,
    previousFields
  });
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
