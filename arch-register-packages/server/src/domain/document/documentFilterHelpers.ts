import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';

export type DocumentListCandidate = {
  title: string;
  updatedAt: Date;
  documentTypeId: string | null;
  metadata: DocumentMetadata;
};

export const matchesDocumentCondition = (
  candidate: DocumentListCandidate,
  condition: FilterCondition
): boolean => {
  let value: unknown;
  switch (condition.fieldId) {
    case '_title':
      value = candidate.title;
      break;
    case '_updatedAt':
      value = candidate.updatedAt;
      break;
    case '_documentTypeId':
      value = candidate.documentTypeId;
      break;
    default:
      value = candidate.metadata[condition.fieldId];
  }

  if (condition.op === 'empty') return value == null || value === '';
  if (condition.op === 'not_empty') return value != null && value !== '';
  if (value == null) return false;

  const expected = condition.value;
  switch (condition.op) {
    case 'equals':
      return String(value) === String(expected);
    case 'not_equals':
      return String(value) !== String(expected);
    case 'contains':
      return String(value).toLowerCase().includes(String(expected).toLowerCase());
    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(expected).toLowerCase());
    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(expected).toLowerCase());
    case 'gt':
      return Number(value) > Number(expected);
    case 'lt':
      return Number(value) < Number(expected);
    case 'gte':
      return Number(value) >= Number(expected);
    case 'lte':
      return Number(value) <= Number(expected);
    case 'before':
    case 'after':
    case 'on': {
      const valueTime = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
      const expectedTime = new Date(String(expected)).getTime();
      if (Number.isNaN(valueTime) || Number.isNaN(expectedTime)) return false;
      if (condition.op === 'before') return valueTime < expectedTime;
      if (condition.op === 'after') return valueTime > expectedTime;
      return valueTime === expectedTime;
    }
    default:
      return true;
  }
};

const compareValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date || b instanceof Date) {
    const aTime = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const bTime = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return aTime - bTime;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

export const compareDocuments = (
  a: DocumentListCandidate,
  b: DocumentListCandidate,
  sort: string | undefined,
  dir: 'asc' | 'desc'
): number => {
  let result: number;
  if (sort === 'title') {
    result = compareValues(a.title, b.title);
  } else if (!sort || sort === 'updated_at') {
    result = compareValues(a.updatedAt, b.updatedAt);
  } else {
    result = compareValues(a.metadata[sort], b.metadata[sort]);
  }
  return dir === 'desc' ? -result : result;
};
