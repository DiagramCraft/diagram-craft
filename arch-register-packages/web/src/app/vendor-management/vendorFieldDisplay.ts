import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { formatCurrencyValue } from '../../utils/currencyFormat';
import { scalarValues } from '../../lib/scalarFieldValues';

/** Display label for a Vendor/Contract field id (its schema name, or the id as a fallback).
 *  Mirrors `../strategy-model/capabilityFieldDisplay.ts`'s `fieldLabel`. */
export const fieldLabel = (schema: EntitySchema | undefined, fieldId: string): string =>
  schema?.fields.find(field => field.id === fieldId)?.name ?? fieldId;

const optionLabel = (schema: EntitySchema | undefined, fieldId: string, value: string): string => {
  const field = schema?.fields.find(f => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/**
 * Render a Vendor/Contract entity's value for `fieldId` as a plain string, resolving select
 * options to their labels and currency values to a formatted amount. Returns `'—'` when empty.
 */
export const vendorFieldValue = (
  schema: EntitySchema | undefined,
  entity: EntityRecord,
  fieldId: string
): string => {
  const values = scalarValues(entity[fieldId]);
  if (values.length === 0) return '—';
  return values
    .map(raw => {
      if (raw != null && typeof raw === 'object' && 'amount' in raw) {
        return formatCurrencyValue(raw);
      }
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (typeof raw === 'string') return optionLabel(schema, fieldId, raw);
      return String(raw);
    })
    .join(', ');
};
