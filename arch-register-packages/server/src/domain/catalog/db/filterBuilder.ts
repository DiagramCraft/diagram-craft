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
  _owner: 'e.owner'
};

// Ensures custom fieldIds can only contain characters safe for JSON path interpolation.
// Prevents injection in `e.data->>'fieldId'` and `json_extract(e.data, '$.fieldId')`.
export const isValidFieldId = (id: string): boolean => /^[a-zA-Z0-9_-]+$/.test(id);

export const escapeLike = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Builds a SQL WHERE fragment for a single FilterCondition.
 *
 * @param col  - SQL column expression (from ENTITY_BUILTIN_COLUMNS or a JSON accessor)
 * @param cond - the condition to translate
 * @param addParam - dialect-specific function that appends `v` to the param list
 *                   and returns the placeholder string ('?' for SQLite, '$N' for Postgres)
 * @param dialect  - controls ILIKE vs LOWER(…) LIKE LOWER(…)
 */
export const buildConditionClause = (
  col: string,
  cond: FilterCondition,
  addParam: (v: unknown) => string,
  dialect: 'postgres' | 'sqlite'
): string | null => {
  const ilike = (ph: string) =>
    dialect === 'postgres' ? `${col} ILIKE ${ph}` : `LOWER(${col}) LIKE LOWER(${ph})`;

  switch (cond.op) {
    case 'empty':
      return `(${col} IS NULL OR ${col} = '')`;
    case 'not_empty':
      return `(${col} IS NOT NULL AND ${col} != '')`;
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
    default:
      return null;
  }
};
