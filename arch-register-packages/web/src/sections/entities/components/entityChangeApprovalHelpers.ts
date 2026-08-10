import type { EntityChangeApprovalRevision } from '@arch-register/api-types/entityChangeContract';

const changeApprovalFieldLabels: Record<string, string> = {
  slug: 'Slug',
  namespace: 'Namespace',
  name: 'Name',
  description: 'Description',
  owner: 'Owner',
  lifecycle: 'Lifecycle',
  target_lifecycle: 'Target lifecycle',
  target_lifecycle_date: 'Target lifecycle date',
  tags: 'Tags',
  links: 'Links',
  schema_id: 'Schema',
  data: 'Entity fields',
  project_id: 'Project'
};

const humanizeChangeApprovalKey = (key: string) =>
  key.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

export const formatChangeApprovalValue = (value: unknown): string => {
  if (value == null || value === '') return 'Empty';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Empty';
    return value.map(formatChangeApprovalValue).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['name'] === 'string') return record['name'];
    if (typeof record['label'] === 'string') return record['label'];
    return Object.entries(record)
      .map(
        ([key, nestedValue]) =>
          `${humanizeChangeApprovalKey(key)}: ${formatChangeApprovalValue(nestedValue)}`
      )
      .join(' · ');
  }
  return String(value);
};

const changeApprovalValuesEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (left == null || right == null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => changeApprovalValuesEqual(value, right[index]));
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys].every(key => changeApprovalValuesEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
};

export const changeApprovalDiffRows = (revision: EntityChangeApprovalRevision) =>
  Object.entries(revision.diff).flatMap(([key, change]) => {
    const values = change as { before?: unknown; after?: unknown };
    if (
      key === 'data' &&
      values.before != null &&
      typeof values.before === 'object' &&
      !Array.isArray(values.before) &&
      values.after != null &&
      typeof values.after === 'object' &&
      !Array.isArray(values.after)
    ) {
      const before = values.before as Record<string, unknown>;
      const after = values.after as Record<string, unknown>;
      return [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(field => !changeApprovalValuesEqual(before[field], after[field]))
        .map(field => ({
          field: `Entity field · ${humanizeChangeApprovalKey(field)}`,
          before: before[field],
          after: after[field]
        }));
    }
    return [
      {
        field: changeApprovalFieldLabels[key] ?? humanizeChangeApprovalKey(key),
        before: values.before,
        after: values.after
      }
    ];
  });
