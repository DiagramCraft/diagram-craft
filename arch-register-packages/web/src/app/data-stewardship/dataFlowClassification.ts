import type { RelationField, RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { scalarValues } from '../../lib/scalarFieldValues';

/**
 * Classification-derived business rules for Data Flow relations (#3065's `pii-classification`,
 * `cross_boundary`, and `residency_invalid` fields), shared by the Classification section's
 * Restricted Flows and Cross-boundary Transfers views. Mirrors `datasetCoverage.ts`'s pattern of
 * isolating the shipped-vs-design-gap logic in one pure module instead of scattering it across
 * screens.
 */

/** The `pii-classification` enum values the issue calls "Restricted/Confidential" — not literal
 *  enum values (the enum is `none | public | non-sensitive | sensitive | highly-sensitive`), so
 *  this is the actual filter both flow views and `ClassifiedDataView` apply. */
export const RESTRICTED_CLASSIFICATIONS = ['sensitive', 'highly-sensitive'] as const;

export const isRestrictedClassification = (value: unknown): boolean =>
  typeof value === 'string' &&
  (RESTRICTED_CLASSIFICATIONS as readonly string[]).includes(value);

/** "Personal data" is derived from classification, not a dedicated field — Data Entity/Data Flow
 *  have no `personal_data` field. Kept as a separately named export (rather than inlined at every
 *  call site) since it's read for a conceptually distinct column than raw restricted-ness. */
export const isPersonalData = (value: unknown): boolean => isRestrictedClassification(value);

export type DataFlowCoverage = {
  crossBoundary: boolean;
  /** Always `false` — the exception/waiver model (#3301) doesn't exist yet. When it ships, wire
   *  the real lookup in here; no other call site should need to change. */
  hasSafeguard: boolean;
  carriesPersonalData: boolean;
  unsafeguardedPersonalDataTransfer: boolean;
};

export const evaluateDataFlowCoverage = (input: {
  crossBoundary: unknown;
  classification: unknown;
}): DataFlowCoverage => {
  const crossBoundary = input.crossBoundary === 'cross-boundary';
  const hasSafeguard = false;
  const carriesPersonalData = isPersonalData(input.classification);
  return {
    crossBoundary,
    hasSafeguard,
    carriesPersonalData,
    unsafeguardedPersonalDataTransfer: crossBoundary && carriesPersonalData && !hasSafeguard
  };
};

const optionLabel = (schema: RelationSchema | undefined, fieldId: string, value: string): string => {
  const field = schema?.fields.find((f: RelationField) => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/**
 * Render a Data Flow relation's value for `fieldId` as a plain string, resolving select options
 * to their labels. Returns `'—'` when empty. Mirrors `datasetFieldDisplay.ts`'s `datasetFieldValue`
 * for entities — relation-schema select fields carry the same resolved `options` shape.
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
