import type { EntityQuery, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

// Encodes which "side" of the relation a filter condition targets into a flat fieldId, the same
// way ASSESSMENT_FIELD_PREFIX lets a flat FilterCondition[] address a joined assessment's fields
// (assessmentFilter.ts) — lets one flat filter-row list cover both the relation's own fields and
// its "in"/"out" endpoint entity's fields without FilterCondition needing a path.
export const ENDPOINT_FIELD_PREFIX = { in: 'in:', out: 'out:' } as const;

export const endpointFieldId = (direction: 'in' | 'out', fieldId: string): string =>
  `${ENDPOINT_FIELD_PREFIX[direction]}${fieldId}`;

export const parseEndpointFieldId = (
  fieldId: string
): { direction: 'in' | 'out'; fieldId: string } | null => {
  if (fieldId.startsWith(ENDPOINT_FIELD_PREFIX.in)) {
    return { direction: 'in', fieldId: fieldId.slice(ENDPOINT_FIELD_PREFIX.in.length) };
  }
  if (fieldId.startsWith(ENDPOINT_FIELD_PREFIX.out)) {
    return { direction: 'out', fieldId: fieldId.slice(ENDPOINT_FIELD_PREFIX.out.length) };
  }
  return null;
};

const conditionToNode = (condition: FilterCondition): QueryNode => {
  const endpoint = parseEndpointFieldId(condition.fieldId);
  if (endpoint) {
    return {
      kind: 'predicate',
      path: [{ kind: 'endpoint', direction: endpoint.direction }],
      fieldId: endpoint.fieldId,
      op: condition.op,
      value: condition.value
    };
  }
  return {
    kind: 'predicate',
    path: [],
    fieldId: condition.fieldId,
    op: condition.op,
    value: condition.value
  };
};

// Builds the relation-rooted EntityQuery sent to /relations/query from the browser's flat filter
// conditions — the relation-schema equivalent of entityBrowserState.ts's
// buildEntityQueryFromBrowserFilters, minus free text (relations have no free-text-searchable
// fields). Always schema-less (root_kind: 'relation', no `schemaId`) — the browser has no separate
// schema picker; "type" is just another filter condition on the `_schemaId` builtin field (see
// RELATION_TYPE_FIELD_ID below), narrowing results the same way any other predicate would.
export const buildRelationQueryFromFilters = (conditions: FilterCondition[]): EntityQuery => ({
  root_kind: 'relation',
  root: {
    kind: 'and',
    children: conditions.map(conditionToNode)
  }
});

// The relation-rooted query IR's builtin field id for a relation's own schema (RELATION_BUILTIN_COLUMNS
// in entityQueryIRCompiler.ts maps this to the `schema_id` column) — used both as a filterable "Type"
// field in RelationFilterBuilder and to detect when the browser is narrowed to a single relation type.
export const RELATION_TYPE_FIELD_ID = '_schemaId';

// Resolves the single relation schema id the browser is narrowed to, if any — i.e. exactly one
// `_schemaId equals <id>` condition. Table columns and own/endpoint-field filtering both need a
// single concrete schema to know which fields exist, so both fall back to a generic (schema-less)
// view whenever this returns null (no Type filter, a `not_equals`, or more than one `equals`).
export const resolveSingleSchemaFilter = (conditions: FilterCondition[]): string | null => {
  const equalsValues = conditions
    .filter(c => c.fieldId === RELATION_TYPE_FIELD_ID && c.op === 'equals')
    .map(c => c.value);
  return equalsValues.length === 1 && typeof equalsValues[0] === 'string' ? equalsValues[0] : null;
};
