import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { assertNoExternalFieldWrites } from '../externalMetadata/externalMetadataHelpers';
import { parseCurrencyValue } from '../../utils/currencyValue';
import { httpAssert } from '../../utils/httpAssert';

/**
 * Rejects a plain (non-external-update) entity create/update that sets or changes the value of
 * any schema field carrying `external_kind` — such fields are read-only to ordinary users and
 * API callers. `currentData` is `{}` for a brand-new entity, so any supplied value for an
 * already-external field is rejected there too.
 */
export const assertNoExternalEntityFieldWrites = (
  fields: SchemaField[],
  currentData: Record<string, unknown>,
  nextData: Record<string, unknown>
) => assertNoExternalFieldWrites(fields, currentData, nextData);

export const normalizeEntityCurrencyFields = (
  fields: SchemaField[],
  values: Record<string, unknown>,
  supportedCurrencies: Set<string>
) => {
  for (const field of fields) {
    if (field.type !== 'currency' || !(field.id in values)) continue;
    const rawValue = values[field.id];
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    const value = parseCurrencyValue(rawValue);
    httpAssert.present(value, {
      status: 400,
      message: `${field.name} must contain an amount and three-letter currency code`
    });
    httpAssert.true(supportedCurrencies.has(value.currency), {
      status: 400,
      message: `${field.name} uses unsupported currency '${value.currency}'`
    });
    values[field.id] = value;
  }
  return values;
};
