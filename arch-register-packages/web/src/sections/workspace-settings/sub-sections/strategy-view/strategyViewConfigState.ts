import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  strategyModelViewConfigSchema,
  TABLE_PSEUDO_FIELD_IDS,
  type StrategyModelViewConfig
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

export type FieldChoice = { id: string; label: string };

/** Non-archived fields on the schema, as `{ id, label }` — for generic field pickers. */
export const schemaFieldChoices = (schema: EntitySchema | undefined): FieldChoice[] =>
  (schema?.fields ?? [])
    .filter(field => !('archived' in field && field.archived))
    .map(field => ({ id: field.id, label: field.name }));

/** Numeric fields (number, or derived number/rating) — roll-up and overlay candidates. */
export const numericFieldChoices = (schema: EntitySchema | undefined): FieldChoice[] =>
  (schema?.fields ?? [])
    .filter(field => {
      if ('archived' in field && field.archived) return false;
      if (field.type === 'number' || field.type === 'currency') return true;
      return (
        field.type === 'derived' &&
        (field.resultType === 'number' ||
          field.resultType === 'rating' ||
          field.resultType === 'currency')
      );
    })
    .map(field => ({ id: field.id, label: field.name }));

/** Select fields (select, or derived select) — categorical axis / widget candidates. */
export const selectFieldChoices = (schema: EntitySchema | undefined): FieldChoice[] =>
  (schema?.fields ?? [])
    .filter(field => {
      if ('archived' in field && field.archived) return false;
      return field.type === 'select' || (field.type === 'derived' && field.resultType === 'select');
    })
    .map(field => ({ id: field.id, label: field.name }));

export const TABLE_PSEUDO_CHOICES: FieldChoice[] = [
  { id: '_name', label: 'Name' },
  { id: '_level', label: 'Level' },
  { id: '_owner', label: 'Owner' },
  { id: '_apps', label: 'Applications' }
];

export const isTablePseudoField = (fieldId: string): boolean =>
  (TABLE_PSEUDO_FIELD_IDS as readonly string[]).includes(fieldId);

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

/** Immutable list helpers shared by every row editor. */
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
