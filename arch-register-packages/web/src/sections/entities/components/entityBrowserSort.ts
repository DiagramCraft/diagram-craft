import {
  isAssessmentFieldId,
  resolveAssessmentValue
} from '@arch-register/api-types/assessmentFilter';
import { nextSortState, type SortState } from '../../../components/table/useTableSort';
import { scalarValues } from '../../../lib/scalarFieldValues';
import { PROJECTION_FIELD_PREFIX } from './entityDisplayFields';
import type { BrowserEntityRecord } from './entityBrowserState';

/**
 * The entity browser's `sort` string. The legacy values (`name`, `type`, `owner`, `completeness`,
 * `date:<fieldId>`) are kept as-is; `field:<fieldId>:asc|desc` sorts by any display column in either
 * direction (`fieldId` being a schema field id, a `_`-prefixed standard field, or a
 * `_projection:<alias>` query projection).
 */
export const FIELD_SORT_PREFIX = 'field:';

const FIELD_SORT_PATTERN = /^field:(.+):(asc|desc)$/;

export const encodeFieldSort = (fieldId: string, dir: 'asc' | 'desc'): string =>
  `${FIELD_SORT_PREFIX}${fieldId}:${dir}`;

/** The sort as a (column, direction) pair, or `null` for sorts that aren't a single column
 *  (e.g. `type`). Legacy sorts are all ascending. */
export const parseSort = (sort: string): SortState | null => {
  const match = FIELD_SORT_PATTERN.exec(sort);
  if (match) return { key: match[1]!, dir: match[2] as 'asc' | 'desc' };
  if (sort === 'name') return { key: '_name', dir: 'asc' };
  if (sort === 'owner') return { key: '_owner', dir: 'asc' };
  if (sort === 'completeness') return { key: '_completeness', dir: 'asc' };
  if (sort.startsWith('date:')) return { key: sort.slice(5), dir: 'asc' };
  return null;
};

/** Inverse of `parseSort` for a state produced by a header click; `name` ascending keeps the
 *  plain `name` value, which is also what enables paged browsing. */
export const encodeSort = (state: SortState): string =>
  state.key === '_name' && state.dir === 'asc' ? 'name' : encodeFieldSort(state.key, state.dir);

/** The sort string after a click on column `key`: a new column starts ascending, a repeat click
 *  flips the direction. */
export const nextSort = (current: string, key: string): string =>
  encodeSort(nextSortState(parseSort(current), key));

export const isFieldSort = (sort: string): boolean => FIELD_SORT_PATTERN.test(sort);

type SortValue = string | number | null;

const normalize = (value: unknown): SortValue => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value);
};

export const getSortValue = (entity: BrowserEntityRecord, fieldId: string): SortValue => {
  switch (fieldId) {
    case '_name':
      return normalize(entity._name ?? entity._slug);
    case '_owner':
      return normalize(entity._owner?.name);
    case '_lifecycle':
      return normalize(entity._lifecycle?.name);
    case '_description':
      return normalize(entity._description);
    case '_slug':
      return normalize(entity._slug);
    case '_namespace':
      return normalize(entity._namespace);
    case '_tags':
      return normalize(entity._tags?.join(', '));
    case '_completeness':
      return normalize(entity._completeness);
    case '_usageCount':
      return normalize(entity._usageCount);
    case '_conformanceStatus':
      return normalize(entity._conformanceStatus);
    case '_projectRole':
      return normalize(entity._projectLink?.entityType?.name);
    case '_projectStatus':
      return normalize(entity._projectLink?.linked ? (entity._projectLink.isDone ? 1 : 0) : null);
  }
  if (fieldId.startsWith(PROJECTION_FIELD_PREFIX)) {
    const value = entity._projections?.[fieldId.slice(PROJECTION_FIELD_PREFIX.length)];
    return normalize(Array.isArray(value) ? value[0] : value);
  }
  if (isAssessmentFieldId(fieldId)) return normalize(resolveAssessmentValue(entity, fieldId));
  return normalize(scalarValues(entity[fieldId])[0]);
};

const compareValues = (a: Exclude<SortValue, null>, b: Exclude<SortValue, null>): number =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

/** Compares two entities by a column. Empty values sort last in either direction. */
export const compareBySort = (
  a: BrowserEntityRecord,
  b: BrowserEntityRecord,
  sort: SortState
): number => {
  const aValue = getSortValue(a, sort.key);
  const bValue = getSortValue(b, sort.key);
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  const result = compareValues(aValue, bValue);
  return sort.dir === 'desc' ? -result : result;
};
