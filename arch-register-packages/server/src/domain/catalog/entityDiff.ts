import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  filterRestrictedFieldGroups,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';

export type EntityFieldDiff = {
  before: unknown;
  after: unknown;
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
};

export const equalEntityValue = (left: unknown, right: unknown) =>
  stableStringify(left) === stableStringify(right);

export const mutableStateKeys = [
  'slug',
  'namespace',
  'name',
  'description',
  'owner',
  'lifecycle',
  'target_lifecycle',
  'target_lifecycle_date',
  'tags',
  'links',
  'schema_id',
  'data',
  'project_id'
] as const;

export const buildDiff = (
  base: Record<string, unknown>,
  proposed: Record<string, unknown>
): Record<string, EntityFieldDiff> =>
  Object.fromEntries(
    mutableStateKeys
      .filter(key => !equalEntityValue(base[key], proposed[key]))
      .map(key => [key, { before: base[key] ?? null, after: proposed[key] ?? null }])
  );

/**
 * Redacts the `data` sub-entry of a diff (produced by `buildDiff`) so fields in a group the
 * caller cannot view are omitted from both `before` and `after`. If redaction makes the two
 * sides equal, the `data` key is dropped entirely rather than shown as a no-op change. The
 * remaining keys are returned unmodified, and the object may become empty (`{}`) if `data` was
 * the only key present — callers that use diff presence to decide "did anything change" should
 * compute that from the pre-redaction diff, not this result.
 */
export const redactDataDiff = (
  diff: Record<string, EntityFieldDiff>,
  authCtx: WorkspaceAuthorizationContext | null,
  fromSchema: FieldGroupSchemaShape | null,
  toSchema: FieldGroupSchemaShape | null
): Record<string, EntityFieldDiff> => {
  const dataDiff = diff.data;
  if (!dataDiff) return diff;

  const before = filterRestrictedFieldGroups(
    authCtx,
    fromSchema,
    (dataDiff.before ?? {}) as Record<string, unknown>
  );
  const after = filterRestrictedFieldGroups(
    authCtx,
    toSchema,
    (dataDiff.after ?? {}) as Record<string, unknown>
  );

  const { data: _data, ...rest } = diff;
  return equalEntityValue(before, after) ? rest : { ...rest, data: { before, after } };
};
