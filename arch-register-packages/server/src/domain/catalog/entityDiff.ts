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
