import type {
  RelationField,
  RelationSchema
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { scalarValues } from '../../lib/scalarFieldValues';

/**
 * Display helper for Data Flow relation fields (direction, classification, protocol, and the
 * shared `data-flow-governance` field group). Duplicated from
 * `../data-stewardship/dataFlowClassification.ts`'s `relationFieldValue` rather than imported —
 * there is no cross-`app/*` import precedent between sibling apps in this codebase.
 */

/** The `pii-classification` enum values treated as "restricted" for the stat tile — the enum is
 *  `none | public | non-sensitive | sensitive | highly-sensitive`. Mirrors
 *  `../data-stewardship/dataFlowClassification.ts`'s `RESTRICTED_CLASSIFICATIONS`. */
export const RESTRICTED_CLASSIFICATIONS = ['sensitive', 'highly-sensitive'] as const;

const optionLabel = (
  schema: RelationSchema | undefined,
  fieldId: string,
  value: string
): string => {
  const field = schema?.fields.find((f: RelationField) => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/**
 * Render a Data Flow relation's value for `fieldId` as a plain string, resolving select options
 * to their labels. Returns `'—'` when empty.
 */
export const relationFieldValue = (
  schema: RelationSchema | undefined,
  relation: RelationRecord,
  fieldId: string
): string => {
  const values = scalarValues(relation[fieldId]);
  if (values.length === 0) return '—';
  return values
    .map(raw => {
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (typeof raw === 'string') return optionLabel(schema, fieldId, raw);
      return String(raw);
    })
    .join(', ');
};
