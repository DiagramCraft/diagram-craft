import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  strategyModelViewConfigSchema,
  type FieldView,
  type StrategyModelViewConfig
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

export type FieldChoice = { id: string; label: string };

/** True for fields that can be aggregated / drawn as a bar / delta / overlay. */
export const isNumericFieldType = (schema: EntitySchema | undefined, fieldId: string): boolean => {
  const field = schema?.fields.find(candidate => candidate.id === fieldId);
  if (!field) return false;
  if (field.type === 'number' || field.type === 'currency') return true;
  return (
    field.type === 'derived' &&
    (field.resultType === 'number' ||
      field.resultType === 'rating' ||
      field.resultType === 'currency')
  );
};

/** Select fields (select, or derived select) — for the Overview count-by-select widget. */
export const selectFieldChoices = (schema: EntitySchema | undefined): FieldChoice[] =>
  (schema?.fields ?? [])
    .filter(field => {
      if ('archived' in field && field.archived) return false;
      return field.type === 'select' || (field.type === 'derived' && field.resultType === 'select');
    })
    .map(field => ({ id: field.id, label: field.name }));

/** Numeric-field choices — for the Overview top-N widget. */
export const numericFieldChoices = (schema: EntitySchema | undefined): FieldChoice[] =>
  (schema?.fields ?? [])
    .filter(field => !('archived' in field && field.archived))
    .filter(field => isNumericFieldType(schema, field.id))
    .map(field => ({ id: field.id, label: field.name }));

/** Parse a stored `view_config` blob into a full config, falling back to the default. */
export const toEditableConfig = (raw: unknown): StrategyModelViewConfig => {
  if (raw == null || (typeof raw === 'object' && Object.keys(raw as object).length === 0)) {
    return structuredClone(DEFAULT_STRATEGY_VIEW_CONFIG);
  }
  const parsed = strategyModelViewConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : structuredClone(DEFAULT_STRATEGY_VIEW_CONFIG);
};

/** True when the draft differs from what is stored (or from the default, when nothing is stored). */
export const viewConfigDirty = (draft: StrategyModelViewConfig, stored: unknown): boolean =>
  JSON.stringify(draft) !== JSON.stringify(toEditableConfig(stored));

/**
 * Materialize the config's `fields` list into one entry per live (non-archived) schema field, in
 * display order (configured entries first, then any schema fields not yet in the config, all-off).
 * The editor always writes back the full list, so ordering is stable.
 */
export const materializeFieldViews = (
  config: StrategyModelViewConfig,
  schema: EntitySchema | undefined
): FieldView[] => {
  const liveIds = new Set(
    (schema?.fields ?? [])
      .filter(field => !('archived' in field && field.archived))
      .map(field => field.id)
  );
  const configured = config.fields.filter(field => liveIds.has(field.fieldId));
  const seen = new Set(configured.map(field => field.fieldId));
  const rest: FieldView[] = (schema?.fields ?? [])
    .filter(field => liveIds.has(field.id) && !seen.has(field.id))
    .map(field => ({ fieldId: field.id, table: null, rollup: null, drawer: false, overlay: null }));
  return [...configured, ...rest];
};

/** Immutable list helpers shared by the row editors. */
export const listOps = {
  update: <T>(list: T[], index: number, patch: Partial<T>): T[] =>
    list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
  remove: <T>(list: T[], index: number): T[] => list.filter((_, i) => i !== index),
  add: <T>(list: T[], item: T): T[] => [...list, item],
  move: <T>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return list;
    next.splice(to, 0, moved);
    return next;
  }
};

export { DEFAULT_STRATEGY_VIEW_CONFIG };
