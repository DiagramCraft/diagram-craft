import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { scalarValues } from '../../../lib/scalarFieldValues';

/** Pseudo column ids for relation metadata, alongside the relation schema's own field ids/names. */
export const RELATION_TABLE_META_COLUMNS = {
  _owner: 'Owner',
  _lifecycle: 'Lifecycle',
  _updatedAt: 'Updated'
} as const;

export type RelationTableMetaColumnId = keyof typeof RELATION_TABLE_META_COLUMNS;

type RelationField = RelationSchema['fields'][number];

export type RelationTableColumn =
  | { kind: 'meta'; id: RelationTableMetaColumnId; label: string }
  | { kind: 'field'; id: string; label: string; field: RelationField };

export const isMetaColumnId = (id: string): id is RelationTableMetaColumnId =>
  id in RELATION_TABLE_META_COLUMNS;

/**
 * Composes the entity-query DSL text a RelationTable runs: it is always rooted on the configured
 * relation schema (`schema:"<name>"`), AND-ed with the optional `filter`. `$variable` references in
 * `filter` are substituted by the dashboard before the widget sees its config.
 */
export const buildRelationQueryText = (schemaName: string, filter: string | undefined): string => {
  const root = `schema:"${schemaName.replaceAll('"', '\\"')}"`;
  const trimmed = filter?.trim();
  return trimmed ? `${root} AND (${trimmed})` : root;
};

/** Resolves configured column ids against the schema — by field id first, then by field name.
 *  Unknown ids are dropped, so a stale seed degrades to fewer columns instead of throwing. */
export const resolveRelationTableColumns = (
  fieldIds: readonly string[],
  schema: RelationSchema | undefined
): RelationTableColumn[] =>
  fieldIds.flatMap((id): RelationTableColumn[] => {
    if (isMetaColumnId(id)) return [{ kind: 'meta', id, label: RELATION_TABLE_META_COLUMNS[id] }];
    const field = schema?.fields.find(candidate => candidate.id === id || candidate.name === id);
    return field ? [{ kind: 'field', id: field.id, label: field.name, field }] : [];
  });

const optionLabel = (field: RelationField, value: string): string => {
  if ((field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/** Plain-text rendering of a scalar (non entity-relation) field value; select values resolve to
 *  their option labels. Empty values render as an empty string. */
export const formatRelationFieldValue = (field: RelationField, value: unknown): string =>
  scalarValues(value)
    .map(raw => {
      if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
      if (typeof raw === 'string') return optionLabel(field, raw);
      return String(raw);
    })
    .join(', ');

/** Compares values for sorting: empties last, numbers numerically, everything else as text. */
export const compareRelationValues = (a: string | number | null, b: string | number | null) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

/** A multi-select filter on one relation field; typically `values: ['$variable']` bound to a
 *  `facets` sidebar. An empty `values` list means "no constraint". */
export type RelationFacetFilter = { fieldId: string; values: string[] };

/**
 * AND-s `in` predicates for each non-empty facet filter onto `query`. `fieldId` is a field id or
 * name on `schema` (names keep seeds workspace-independent); filters naming an unknown field are
 * skipped, so a stale seed degrades to "no constraint" instead of emptying the table.
 */
export const applyRelationFacetFilters = (
  query: EntityQuery,
  schema: RelationSchema | undefined,
  filters: readonly RelationFacetFilter[] | undefined
): EntityQuery => {
  const predicates = (filters ?? []).flatMap(filter => {
    const field = schema?.fields.find(
      candidate => candidate.id === filter.fieldId || candidate.name === filter.fieldId
    );
    if (!field || filter.values.length === 0) return [];
    return [
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: field.id,
        op: 'in' as const,
        value: filter.values
      }
    ];
  });
  if (predicates.length === 0) return query;
  return { ...query, root: { kind: 'and', children: [query.root, ...predicates] } };
};
