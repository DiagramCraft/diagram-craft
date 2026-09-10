import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { formatCurrencyValue } from '../../utils/currencyFormat';
import { scalarValues } from '../../lib/scalarFieldValues';

/** Display label for a `business_capability` field id (its schema name, or the id as a fallback). */
export const fieldLabel = (schema: EntitySchema | undefined, fieldId: string): string =>
  schema?.fields.find(field => field.id === fieldId)?.name ?? fieldId;

const optionLabel = (schema: EntitySchema | undefined, fieldId: string, value: string): string => {
  const field = schema?.fields.find(f => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/** A `business_capability` entity's own numeric value for `fieldId` (currency → its amount). */
export const capabilityNumericValue = (
  entity: EntityRecord,
  fieldId: string
): { value: number | null; currency: string | null } => {
  const raw = scalarValues(entity[fieldId])[0];
  if (raw != null && typeof raw === 'object' && 'amount' in raw) {
    const money = raw as { amount?: unknown; currency?: unknown };
    return {
      value: typeof money.amount === 'number' ? money.amount : null,
      currency: typeof money.currency === 'string' ? money.currency : null
    };
  }
  return { value: typeof raw === 'number' ? raw : null, currency: null };
};

/**
 * Render a `business_capability` entity's value for `fieldId` as a plain string, resolving select
 * options to their labels and currency values to a formatted amount. Returns `'—'` when empty.
 */
export const capabilityFieldValue = (
  schema: EntitySchema | undefined,
  entity: EntityRecord,
  fieldId: string
): string => {
  const values = scalarValues(entity[fieldId]);
  if (values.length === 0) return '—';
  return values
    .map(raw => {
      if (raw != null && typeof raw === 'object' && 'amount' in raw) {
        const money = raw as { amount: number; currency: string | null };
        return formatCurrencyValue({ amount: money.amount, currency: money.currency });
      }
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (typeof raw === 'string') return optionLabel(schema, fieldId, raw);
      return String(raw);
    })
    .join(', ');
};
