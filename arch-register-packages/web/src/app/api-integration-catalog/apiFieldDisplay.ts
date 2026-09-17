import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { scalarValues } from '../../lib/scalarFieldValues';

/** Display label for an `api` schema field id (its schema name, or the id as a fallback).
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

/** All of an `api` entity's values for `fieldId` (multi-select fields like `protocols` can carry
 *  more than one), resolving select options to their labels. */
export const apiFieldValues = (
  schema: EntitySchema | undefined,
  entity: EntityRecord,
  fieldId: string
): string[] =>
  scalarValues(entity[fieldId]).map(raw =>
    typeof raw === 'string' ? optionLabel(schema, fieldId, raw) : String(raw)
  );

/** Render an `api` entity's value for `fieldId` as a plain string. Returns `'—'` when empty. */
export const apiFieldValue = (
  schema: EntitySchema | undefined,
  entity: EntityRecord,
  fieldId: string
): string => {
  const values = apiFieldValues(schema, entity, fieldId);
  return values.length === 0 ? '—' : values.join(', ');
};
