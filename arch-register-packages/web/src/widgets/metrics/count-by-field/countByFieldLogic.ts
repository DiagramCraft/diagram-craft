import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { scalarValues } from '../../../lib/scalarFieldValues';

export type CountBucket = {
  id: string;
  label: string;
  count: number;
  percent: number;
};

export const UNASSIGNED_LABEL = 'Unassigned';

const fieldOptions = (schema: EntitySchema | undefined, fieldId: string) => {
  const field = schema?.fields.find(f => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options ?? [];
  }
  return [];
};

/**
 * Counts `entities` per distinct value of `fieldId`. Buckets follow the field's option order when
 * it has options (unlisted values after, alphabetically), otherwise alphabetical; entities with
 * no value fall into a trailing "Unassigned" bucket.
 */
export const buildCountBuckets = (
  entities: readonly EntityRecord[],
  schema: EntitySchema | undefined,
  fieldId: string
): CountBucket[] => {
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const entity of entities) {
    const first = scalarValues(entity[fieldId])[0];
    if (first == null) {
      unassigned++;
    } else {
      const key = String(first);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const options = fieldOptions(schema, fieldId);
  const rank = (key: string) => {
    const index = options.findIndex(option => option.value === key);
    return index === -1 ? options.length : index;
  };
  const total = entities.length || 1;

  const buckets = [...counts.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, count]) => ({
      id: key,
      label: options.find(option => option.value === key)?.label ?? key,
      count,
      percent: (count / total) * 100
    }));
  if (unassigned > 0) {
    buckets.push({
      id: UNASSIGNED_LABEL,
      label: UNASSIGNED_LABEL,
      count: unassigned,
      percent: (unassigned / total) * 100
    });
  }
  return buckets;
};
