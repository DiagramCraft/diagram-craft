import type { EntityRecord } from '@arch-register/api-types/entityContract';

/**
 * A `reference` schema field is stored (and returned by the `full` projection) as an array of
 * entity ids — occasionally as `{ id }` objects. Normalizes both to a flat id list.
 */
export const referenceIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as { id: unknown }).id;
        return typeof id === 'string' ? id : '';
      }
      return '';
    })
    .filter(Boolean);
};

/** Entities whose `referenceField` points at any of `targetIds`. */
export const filterByReference = (
  entities: readonly EntityRecord[],
  referenceField: string,
  targetIds: ReadonlySet<string>
): EntityRecord[] =>
  targetIds.size === 0
    ? []
    : entities.filter(entity => referenceIds(entity[referenceField]).some(id => targetIds.has(id)));

/**
 * Entities reaching `targetId` through an optional chain of reference hops. `hops` is ordered
 * from the target outwards: `[{ entities: outcomes, referenceField: 'objectives' }]` finds the
 * outcomes of an objective; adding a second hop for measures (`outcomes` field) finds the measures
 * tracking those outcomes. Only the entities of the last hop are returned.
 */
export const resolveRelatedEntities = (
  targetId: string,
  hops: ReadonlyArray<{ entities: readonly EntityRecord[]; referenceField: string }>
): EntityRecord[] => {
  let ids: ReadonlySet<string> = new Set([targetId]);
  let result: EntityRecord[] = [];
  for (const hop of hops) {
    result = filterByReference(hop.entities, hop.referenceField, ids);
    ids = new Set(result.map(entity => entity._uid));
  }
  return result;
};

const numOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export type ProgressFields = {
  baselineField: string;
  currentField: string;
  targetField: string;
  unitField?: string;
};

export type ProgressValue = {
  /** Current value's position on the baseline→target span, clamped to 0–100. */
  percent: number;
  label: string;
};

/**
 * Baseline → current → target progress. A zero span renders as 0; any missing/non-numeric value
 * yields `null` (no bar).
 */
export const computeProgress = (
  entity: EntityRecord,
  fields: ProgressFields
): ProgressValue | null => {
  const baseline = numOrNull(entity[fields.baselineField]);
  const current = numOrNull(entity[fields.currentField]);
  const target = numOrNull(entity[fields.targetField]);
  if (baseline == null || current == null || target == null) return null;

  const rawUnit = fields.unitField ? entity[fields.unitField] : '';
  const unit = typeof rawUnit === 'string' ? rawUnit : '';
  const span = target - baseline;
  const percent = span === 0 ? 0 : Math.max(0, Math.min(100, (100 * (current - baseline)) / span));
  return { percent, label: `${current}${unit} / ${target}${unit}` };
};
