import type { EntityQuery, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type {
  CreateSavedViewRequest,
  FilterCondition,
  SavedView
} from '@arch-register/api-types/viewContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationSearchParams } from '../../routes/searchParams';

export type RelationBrowserView = 'table' | 'graph';
export const RELATION_GRAPH_TYPE_LABEL = '__relation_type__';

export type RelationGraphLabelOption = {
  value: string;
  label: string;
};

export const getRelationGraphLabelOptions = (
  relationSchemas: RelationSchema[]
): RelationGraphLabelOption[] => {
  const fields = new Map<string, string>();
  for (const schema of relationSchemas) {
    for (const field of schema.fields) {
      fields.set(field.id, field.name);
    }
  }

  return [
    { value: RELATION_GRAPH_TYPE_LABEL, label: 'Relation type' },
    ...[...fields.entries()].map(([value, label]) => ({ value, label }))
  ];
};

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

// Reverse of buildRelationQueryFromFilters/conditionToNode above — used to load a saved view's
// `filters` (or the URL's `entityQuery`) back into the browser's flat FilterCondition[]. Unlike
// entityBrowserState.ts's filterConditionsFromEntityQuery, `_schemaId` is NOT stripped here: for
// relations it's a real filterable condition (RELATION_TYPE_FIELD_ID), not a separate `schemaId`
// field on the query.
const nodeToCondition = (node: QueryNode): FilterCondition | null => {
  if (node.kind !== 'predicate') return null;
  const endpoint = node.path[0];
  const fieldId =
    endpoint?.kind === 'endpoint'
      ? endpointFieldId(endpoint.direction, node.fieldId)
      : node.fieldId;
  return { fieldId, op: node.op, value: node.value };
};

export const filterConditionsFromRelationQuery = (query: EntityQuery): FilterCondition[] =>
  (query.root.kind === 'and' ? query.root.children : [query.root])
    .map(nodeToCondition)
    .filter((c): c is FilterCondition => c != null);

// True when `query` round-trips exactly through the flat Basic-mode condition list above — every
// top-level node is a plain predicate on the relation's own field (`path: []`) or a single
// `endpoint` hop, and there's no projection. An `or` root, a `relationForward` path step (or
// anything deeper), or a projection is NOT representable: #3066 found that
// filterConditionsFromRelationQuery/nodeToCondition silently drop these, which used to mean a
// saved view built around them (e.g. a "restricted flows" view combining the relation's own
// classification with a carried entity's via relationForward, joined by `or`) would silently
// execute an emptied-out or wrong query when opened. Non-representable queries now stay in
// Advanced (text) mode and are sent to the API unmodified — see useRelationBrowserData.ts.
const isRelationConditionNode = (node: QueryNode): boolean =>
  node.kind === 'predicate' &&
  (node.path.length === 0 || (node.path.length === 1 && node.path[0]!.kind === 'endpoint'));

export const isRelationBasicRepresentable = (query: EntityQuery): boolean =>
  !query.projections?.length &&
  (query.root.kind === 'and'
    ? query.root.children.every(isRelationConditionNode)
    : isRelationConditionNode(query.root));

export const parseRelationQueryFromSearch = (
  search: Pick<RelationSearchParams, 'entityQuery'>
): EntityQuery | null => {
  if (!search.entityQuery) return null;
  try {
    const parsed: unknown = JSON.parse(search.entityQuery);
    return parsed != null && typeof parsed === 'object' ? (parsed as EntityQuery) : null;
  } catch {
    return null;
  }
};

export const parseRelationTableFieldIdsFromSearch = (
  search: Pick<RelationSearchParams, 'tableFieldIds'>
): string[] | null => {
  if (!search.tableFieldIds) return null;
  try {
    const parsed: unknown = JSON.parse(search.tableFieldIds);
    return Array.isArray(parsed) && parsed.every(id => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
};

export const toSavedRelationViewSearch = (view: SavedView): RelationSearchParams => ({
  viewId: view.id,
  viewMode: view.viewMode === 'graph' ? 'graph' : undefined,
  entityQuery: JSON.stringify(view.filters),
  edgeLabelFieldId:
    view.viewMode === 'graph' && view.config?.graph?.edgeLabelFieldId != null
      ? view.config.graph.edgeLabelFieldId
      : undefined,
  edgeColorFieldId:
    view.viewMode === 'graph' && view.config?.graph?.edgeColorFieldId != null
      ? view.config.graph.edgeColorFieldId
      : undefined,
  // #3066: not user-editable via the save dialog (no config UI for it yet) — carried through from
  // a seeded/admin-authored view's config so its graph renders relations-as-nodes correctly.
  relationGraphMode:
    view.viewMode === 'graph' && view.config?.graph?.typedRelationMode != null
      ? view.config.graph.typedRelationMode
      : undefined,
  // #3066: same reasoning — a curated table column set (including `_projection:` columns) is
  // only ever set by a seeded/admin-authored view for now, not user-editable via the save dialog.
  tableFieldIds:
    view.viewMode === 'table' && view.config?.table?.fieldIds != null
      ? JSON.stringify(view.config.table.fieldIds)
      : undefined
});

export const buildRelationSavedViewPayload = ({
  name,
  description,
  isAdminView,
  viewMode,
  relationQuery,
  edgeLabelFieldId,
  edgeColorFieldId
}: {
  name: string;
  description: string;
  isAdminView: boolean;
  viewMode: RelationBrowserView;
  // The full stored query (`useRelationBrowserData`'s `relationQuery`), not the flattened
  // `conditions` list - a `relationForward`/`relationBackward` traversal or a projection column
  // (#3120) round-trips through `conditions` lossily (`isRelationBasicRepresentable`), so saving
  // from `conditions` would silently drop them from the saved view.
  relationQuery: EntityQuery;
  edgeLabelFieldId: string;
  edgeColorFieldId: string;
}): CreateSavedViewRequest => ({
  scope: 'workspace',
  projectId: null,
  projectScope: null,
  name,
  description: description || null,
  isAdminView,
  viewMode,
  filters: relationQuery,
  config:
    viewMode === 'graph'
      ? {
          graph: {
            ...(edgeLabelFieldId !== RELATION_GRAPH_TYPE_LABEL ? { edgeLabelFieldId } : {}),
            ...(edgeColorFieldId !== RELATION_GRAPH_TYPE_LABEL ? { edgeColorFieldId } : {})
          }
        }
      : null
});

// The relation-rooted query IR's builtin field id for a relation's own schema (RELATION_BUILTIN_COLUMNS
// in entityQueryIRCompiler.ts maps this to the `schema_id` column) — used both as a filterable "Type"
// field in the relation filter UI and to detect when the browser is narrowed to a single relation type.
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

// #3066: renders a table cell's raw field value as readable plain text. A multi-valued select
// stores plain strings (joined as-is); an entityRelation field (e.g. a Data Flow's carried Data
// Entities) stores referenced entity ids — resolve those via `referenceLookup` before joining, so
// the column shows "Customer Credentials, Order Records" rather than a JSON array of uuids.
export const formatFieldValue = (
  value: unknown,
  fieldType?: string,
  referenceLookup: ReadonlyMap<string, { name: string }> = new Map()
): string => {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map(item =>
        typeof item === 'string' && fieldType === 'entityRelation'
          ? (referenceLookup.get(item)?.name ?? item)
          : formatFieldValue(item)
      )
      .join(', ');
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};
