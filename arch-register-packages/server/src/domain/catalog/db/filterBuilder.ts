import type { FilterCondition } from '@arch-register/api-types/viewContract';

// Maps built-in FilterCondition fieldIds to their actual SQL column expressions.
// Any fieldId not in this map is treated as a custom JSON field.
export const ENTITY_BUILTIN_COLUMNS: Record<string, string> = {
  _name: 'e.name',
  _slug: 'e.slug',
  _description: 'e.description',
  _namespace: 'e.namespace',
  _schemaId: 'e.schema_id',
  _lifecycle: 'e.lifecycle',
  _owner: 'e.owner',
  _updatedAt: 'e.updated_at',
  _projectId: 'e.project_id',
  _completeness: 'e.completeness',
  // Last activity considering both real edits and confirm-mode attestation (see #2410) — the
  // greater of the two, so a recent attestation counts the same as a recent edit for staleness.
  _effectiveActivityAt:
    'CASE WHEN e.last_attested_at IS NOT NULL AND e.last_attested_at > e.updated_at ' +
    'THEN e.last_attested_at ELSE e.updated_at END'
};

// Maps built-in FilterCondition fieldIds backed by a JSON array column, where
// operators match against "any element" rather than the whole column value.
export const ENTITY_ARRAY_COLUMNS: Record<string, string> = {
  _tags: 'e.tags'
};

// Ensures custom fieldIds can only contain characters safe for JSON path interpolation.
// Prevents injection in `e.data->>'fieldId'` and `json_extract(e.data, '$.fieldId')`.
export const isValidFieldId = (id: string): boolean => /^[a-zA-Z0-9_-]+$/.test(id);

export const escapeLike = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// Builds a SQL WHERE fragment for a FilterCondition against a JSON array column
// (e.g. `_tags`), matching when any element satisfies the condition.
const buildArrayConditionClause = (
  col: string,
  cond: FilterCondition,
  addParam: (v: unknown) => string,
  dialect: 'postgres' | 'sqlite',
  currencyValues = false
): string | null => {
  const safeArray =
    dialect === 'postgres'
      ? `CASE WHEN jsonb_typeof(${col}) = 'array' THEN ${col} ELSE '[]'::jsonb END`
      : `CASE WHEN json_type(${col}) = 'array' THEN ${col} ELSE json('[]') END`;
  const from = currencyValues
    ? dialect === 'postgres'
      ? `jsonb_array_elements(${safeArray}) item`
      : `json_each(${safeArray})`
    : dialect === 'postgres'
      ? `jsonb_array_elements_text(${safeArray}) t`
      : `json_each(${safeArray})`;
  const element = currencyValues
    ? dialect === 'postgres'
      ? "item->>'amount'"
      : "json_extract(value, '$.amount')"
    : dialect === 'postgres'
      ? 't'
      : 'value';
  const exists = (predicate: string) => `EXISTS (SELECT 1 FROM ${from} WHERE ${predicate})`;
  const ilike = (ph: string) =>
    dialect === 'postgres' ? `${element} ILIKE ${ph}` : `LOWER(${element}) LIKE LOWER(${ph})`;
  const arrayLength =
    dialect === 'postgres'
      ? `jsonb_array_length(CASE WHEN jsonb_typeof(${col}) = 'array' THEN ${col} ELSE '[]'::jsonb END)`
      : `json_array_length(CASE WHEN json_type(${col}) = 'array' THEN ${col} ELSE json('[]') END)`;

  switch (cond.op) {
    case 'empty':
      return `(${col} IS NULL OR ${arrayLength} = 0)`;
    case 'not_empty':
      return `(${col} IS NOT NULL AND ${arrayLength} > 0)`;
    case 'equals':
      return exists(`${element} = ${addParam(String(cond.value ?? ''))}`);
    case 'not_equals':
      return `NOT ${exists(`${element} = ${addParam(String(cond.value ?? ''))}`)}`;
    case 'contains':
      return exists(ilike(addParam(`%${escapeLike(String(cond.value ?? ''))}%`)));
    case 'starts_with':
      return exists(ilike(addParam(`${escapeLike(String(cond.value ?? ''))}%`)));
    case 'ends_with':
      return exists(ilike(addParam(`%${escapeLike(String(cond.value ?? ''))}`)));
    case 'gt':
      return exists(`CAST(${element} AS NUMERIC) > CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`);
    case 'lt':
      return exists(`CAST(${element} AS NUMERIC) < CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`);
    case 'gte':
      return exists(`CAST(${element} AS NUMERIC) >= CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`);
    case 'lte':
      return exists(`CAST(${element} AS NUMERIC) <= CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`);
    case 'before':
      return exists(`${element} < ${addParam(String(cond.value ?? ''))}`);
    case 'after':
      return exists(`${element} > ${addParam(String(cond.value ?? ''))}`);
    case 'on':
      return exists(`${element} = ${addParam(String(cond.value ?? ''))}`);
    default:
      return null;
  }
};

/**
 * Builds a SQL WHERE fragment for a single FilterCondition.
 *
 * @param col  - SQL column expression (from ENTITY_BUILTIN_COLUMNS or a JSON accessor)
 * @param cond - the condition to translate
 * @param addParam - dialect-specific function that appends `v` to the param list
 *                   and returns the placeholder string ('?' for SQLite, '$N' for Postgres)
 * @param dialect  - controls ILIKE vs LOWER(…) LIKE LOWER(…)
 * @param kind     - 'currency' is a scalar currency object projected to its amount;
 *                   'array' matches against any element of a JSON array column;
 *                   'currency-array' matches against each element's amount
 *                   (see ENTITY_ARRAY_COLUMNS); defaults to 'scalar'
 */
export const buildConditionClause = (
  col: string,
  cond: FilterCondition,
  addParam: (v: unknown) => string,
  dialect: 'postgres' | 'sqlite',
  kind: 'scalar' | 'currency' | 'array' | 'currency-array' = 'scalar'
): string | null => {
  if (kind === 'array' || kind === 'currency-array') {
    return buildArrayConditionClause(col, cond, addParam, dialect, kind === 'currency-array');
  }

  const ilike = (ph: string) =>
    dialect === 'postgres' ? `${col} ILIKE ${ph}` : `LOWER(${col}) LIKE LOWER(${ph})`;

  switch (cond.op) {
    case 'empty':
      // UUID columns in Postgres reject `= ''` (type mismatch); cast to text first
      return dialect === 'postgres'
        ? `(${col} IS NULL OR ${col}::text = '')`
        : `(${col} IS NULL OR ${col} = '')`;
    case 'not_empty':
      return dialect === 'postgres'
        ? `(${col} IS NOT NULL AND ${col}::text != '')`
        : `(${col} IS NOT NULL AND ${col} != '')`;
    case 'equals':
      return `${col} = ${addParam(cond.value ?? '')}`;
    case 'not_equals':
      return `(${col} != ${addParam(cond.value ?? '')} OR ${col} IS NULL)`;
    case 'contains':
      return ilike(addParam(`%${escapeLike(String(cond.value ?? ''))}%`));
    case 'starts_with':
      return ilike(addParam(`${escapeLike(String(cond.value ?? ''))}%`));
    case 'ends_with':
      return ilike(addParam(`%${escapeLike(String(cond.value ?? ''))}`));
    case 'gt':
      return `CAST(${col} AS NUMERIC) > CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`;
    case 'lt':
      return `CAST(${col} AS NUMERIC) < CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`;
    case 'before':
      return `${col} < ${addParam(cond.value ?? '')}`;
    case 'after':
      return `${col} > ${addParam(cond.value ?? '')}`;
    case 'on':
      return `${col} = ${addParam(cond.value ?? '')}`;
    case 'gte':
      return `CAST(${col} AS NUMERIC) >= CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`;
    case 'lte':
      return `CAST(${col} AS NUMERIC) <= CAST(${addParam(cond.value ?? 0)} AS NUMERIC)`;
    case 'in': {
      const values = Array.isArray(cond.value) ? cond.value : [cond.value];
      // An empty list matches nothing, rather than every row (which an empty `IN ()` would be a
      // SQL syntax error for anyway).
      return values.length === 0 ? '1=0' : `${col} IN (${values.map(v => addParam(v)).join(', ')})`;
    }
    default:
      return null;
  }
};
