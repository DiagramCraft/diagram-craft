import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { scalarValues } from '../../lib/scalarFieldValues';

/** Display label for a Risk/Control field id (its schema name, or the id as a fallback).
 *  Mirrors `../vendor-management/vendorFieldDisplay.ts`'s `fieldLabel`. */
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
 * Render a Risk/Control entity's value for `fieldId` as a plain string, resolving select options
 * to their labels. Returns `'—'` when empty.
 */
export const riskFieldValue = (
  schema: EntitySchema | undefined,
  entity: EntityRecord,
  fieldId: string
): string => {
  const values = scalarValues(entity[fieldId]);
  if (values.length === 0) return '—';
  return values
    .map(raw => {
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (typeof raw === 'string') return optionLabel(schema, fieldId, raw);
      return String(raw);
    })
    .join(', ');
};

/** Resolves a relation-schema field's (e.g. `risk-control`'s `effectiveness`) enum option value
 *  to its display label. Relation schemas share the same enum-backed `select` field shape as
 *  entity schemas, but aren't `EntitySchema`s, so this takes the field's raw `options` directly
 *  rather than looking it up on an `EntitySchema`. */
export const relationOptionLabel = (
  options: { value: string; label: string }[] | undefined,
  value: string | null | undefined
): string => {
  if (value == null) return '—';
  return options?.find(option => option.value === value)?.label ?? value;
};
