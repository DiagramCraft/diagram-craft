import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BarListRow } from '../../../components/BarList';
import { scalarValues } from '../../../lib/scalarFieldValues';

export type RatioBarListFields = {
  groupByFieldId: string;
  numeratorFieldId: string;
  numeratorValue: string;
};

const EMPTY_GROUP_KEY = '—';

const optionLabel = (schema: EntitySchema | undefined, fieldId: string, value: string): string => {
  const field = schema?.fields.find(f => f.id === fieldId);
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

const hasValue = (entity: EntityRecord, fieldId: string, value: string): boolean =>
  scalarValues(entity[fieldId]).some(raw => String(raw) === value);

/**
 * Groups `entities` by `groupByFieldId` and reports, per group, how many entities have
 * `numeratorFieldId = numeratorValue` out of the group's total — largest groups first. Entities
 * with no group value fall into a single "—" group.
 */
export const buildRatioBarRows = (
  entities: readonly EntityRecord[],
  schema: EntitySchema | undefined,
  fields: RatioBarListFields
): BarListRow[] => {
  const groups = new Map<string, EntityRecord[]>();
  for (const entity of entities) {
    const first = scalarValues(entity[fields.groupByFieldId])[0];
    const key = first == null ? EMPTY_GROUP_KEY : String(first);
    const group = groups.get(key) ?? [];
    group.push(entity);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, members]) => ({
      id: key,
      label: key === EMPTY_GROUP_KEY ? key : optionLabel(schema, fields.groupByFieldId, key),
      total: members.length,
      effective: members.filter(member =>
        hasValue(member, fields.numeratorFieldId, fields.numeratorValue)
      ).length
    }))
    .sort((a, b) => b.total - a.total);
};
