import type {
  BrowserView,
  CreateSavedViewRequest,
  FilterCondition,
  SavedView
} from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ProjectDetail, ProjectEntity } from '@arch-register/api-types/projectContract';
import {
  isAssessmentCondition,
  ASSESSMENT_FIELD_PREFIX
} from '@arch-register/api-types/assessmentFilter';
import type { EntitySearchParams, ProjectSearchParams } from '../../../routes/searchParams';

export type BrowserSearch = EntitySearchParams &
  ProjectSearchParams & {
    sidebarTab?: 'filters' | 'views' | 'bookmarks';
    collectionId?: string;
  };

export type ProjectLinkState = {
  linked: boolean;
  entityType: { id: string; name: string } | null;
  isDone: boolean;
};

export type BrowserEntityRecord = EntityRecord & {
  _projectLink?: ProjectLinkState;
  _assessment?: Record<string, string | number> | null;
};

export const isEntityInProject = (
  entity: Pick<BrowserEntityRecord, '_projectId' | '_projectLink'>,
  projectId: string
): boolean => entity._projectId === projectId || entity._projectLink?.linked === true;

export type ProjectBrowserContext = {
  project: Pick<ProjectDetail, 'id' | 'canEdit'>;
  projectEntities: ProjectEntity[];
  entityTypeColorMap: Map<string, string>;
  onToggleDone: (entityId: string, isDone: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
  onPlanFutureChange: (entityId: string) => void;
};

export type BrowserViewConfigMap = Partial<Record<BrowserView, unknown>>;

export const parseDateValue = (value: unknown) => {
  if (typeof value !== 'string' || value === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

export const parseConditionsFromSearch = (search: BrowserSearch): FilterCondition[] => {
  const canonicalQuery = parseEntityQueryFromSearch(search);
  if (canonicalQuery != null) return filterConditionsFromEntityQuery(canonicalQuery);
  if (search.filters) {
    try {
      return JSON.parse(search.filters) as FilterCondition[];
    } catch {
      return [];
    }
  }
  const initial: FilterCondition[] = [];
  if (search.type) initial.push({ fieldId: '_schemaId', op: 'equals', value: search.type });
  if (search.status) initial.push({ fieldId: '_lifecycle', op: 'equals', value: search.status });
  if (search.owner) initial.push({ fieldId: '_owner', op: 'equals', value: search.owner });
  return initial;
};

export const parseEntityQueryFromSearch = (search: BrowserSearch): EntityQuery | null => {
  if (!search.entityQuery) return null;
  try {
    const parsed: unknown = JSON.parse(search.entityQuery);
    return parsed != null && typeof parsed === 'object' ? (parsed as EntityQuery) : null;
  } catch {
    return null;
  }
};

const rootChildren = (query: EntityQuery): EntityQuery['root'][] =>
  query.root.kind === 'and' ? query.root.children : [query.root];

const filterConditionsFromEntityQuery = (query: EntityQuery): FilterCondition[] =>
  rootChildren(query)
    .filter(
      (node): node is Extract<EntityQuery['root'], { kind: 'predicate' }> =>
        node.kind === 'predicate' && node.path.length === 0
    )
    .filter(condition => condition.fieldId !== '_schemaId')
    .map(({ fieldId, op, value }) => ({ fieldId, op, value }));

const freeTextQueryNode = (value: string): EntityQuery['root'] => ({
  kind: 'freeText',
  value
});

const isFreeTextQueryNode = (node: EntityQuery['root']) =>
  (node.kind === 'freeText' && typeof node.value === 'string') ||
  (node.kind === 'or' &&
    node.children.length === 3 &&
    node.children.every(
      child =>
        child.kind === 'predicate' &&
        child.path.length === 0 &&
        child.op === 'contains' &&
        typeof child.value === 'string' &&
        ['_name', '_slug', '_description'].includes(child.fieldId)
    ));

const freeTextValueFromNode = (node: EntityQuery['root']): string | undefined => {
  if (node.kind === 'freeText') return node.value;
  if (!isFreeTextQueryNode(node) || node.kind !== 'or') return undefined;
  const value = node.children[0];
  return value?.kind === 'predicate' && typeof value.value === 'string' ? value.value : undefined;
};

const withoutFreeTextQuery = (query: EntityQuery): EntityQuery => {
  if (query.root.kind !== 'and') {
    return isFreeTextQueryNode(query.root)
      ? { ...query, root: { kind: 'and', children: [] } }
      : query;
  }
  return {
    ...query,
    root: {
      ...query.root,
      children: query.root.children.filter(child => !isFreeTextQueryNode(child))
    }
  };
};

export const addFreeTextQuery = (query: EntityQuery, value: string): EntityQuery => {
  const trimmed = value.trim();
  const baseQuery = withoutFreeTextQuery(query);
  if (!trimmed) return baseQuery;
  return {
    ...baseQuery,
    root:
      baseQuery.root.kind === 'and'
        ? { ...baseQuery.root, children: [...baseQuery.root.children, freeTextQueryNode(trimmed)] }
        : { kind: 'and', children: [baseQuery.root, freeTextQueryNode(trimmed)] }
  };
};

/**
 * Merges the live search-box text into `query`'s free-text clause for execution — but only when
 * there IS live search-box text. An empty `q` means "the search box is empty", not "clear
 * whatever free-text clause the query already carries": `query` may own a freeText node that
 * didn't come from this search box at all (an Advanced-mode `text:"..."` predicate, or a saved
 * view's own free-text clause), and blindly running it through `addFreeTextQuery(query, '')`
 * would strip that node via `withoutFreeTextQuery`, silently dropping the filter.
 */
export const withLiveSearchText = (query: EntityQuery, q: string): EntityQuery =>
  q.trim() ? addFreeTextQuery(query, q) : query;

const freeTextFromEntityQuery = (query: EntityQuery): string | undefined => {
  const node = rootChildren(query).find(child => isFreeTextQueryNode(child));
  return node ? freeTextValueFromNode(node) : undefined;
};

/**
 * `printEntityQueryText` (specs/QUERY_LANGUAGE.md §4.4) only ever renders `query.root` — the
 * top-level `EntityQuery.schemaId` field is deliberately out of scope for the text grammar,
 * the same way `assessmentId` is (both are supplied out-of-band, not written into query text).
 * `buildEntityQueryFromBrowserFilters` puts Basic mode's "Type" selection there, though, so
 * printing a Basic-derived query as-is silently drops the type filter from the displayed text.
 * This folds `schemaId` into an equivalent root `_schemaId equals ...` predicate — the same
 * shape a `schema:` qualifier compiles to — purely so `printEntityQueryText` has something to
 * render; it's not meant to replace `schemaId` in the query actually sent for execution.
 */
export const withSchemaIdAsPredicate = (query: EntityQuery): EntityQuery => {
  if (!query.schemaId) return query;
  const schemaPredicate: Extract<EntityQuery['root'], { kind: 'predicate' }> = {
    kind: 'predicate',
    path: [],
    fieldId: '_schemaId',
    op: 'equals',
    value: query.schemaId
  };
  return {
    ...query,
    root:
      query.root.kind === 'and'
        ? { ...query.root, children: [schemaPredicate, ...query.root.children] }
        : { kind: 'and', children: [schemaPredicate, query.root] }
  };
};

/**
 * True when `query` can be represented exactly by Basic mode's flat condition list + free-text
 * box — every top-level node is either a flat predicate (no relation traversal) or the free-text
 * node, and there's no projection. Used to decide whether switching from Advanced to Basic mode
 * is lossless, or needs a confirmation before dropping the rest (grouping, NOT, traversal,
 * relationExists, projections).
 */
export const isBasicRepresentable = (query: EntityQuery): boolean =>
  !query.projections?.length &&
  rootChildren(query).every(
    node => isFreeTextQueryNode(node) || (node.kind === 'predicate' && node.path.length === 0)
  );

/**
 * Best-effort Advanced → Basic conversion: flat top-level predicates become conditions (a
 * `schemaId` set at the query's top level — e.g. via `schema:` text — becomes a `_schemaId`
 * condition, matching how Basic mode expresses "Type" through `FilterBuilder` rather than a
 * separate control), and the free-text node becomes `q`. When `isBasicRepresentable` is false
 * this silently drops whatever Basic can't express (grouping, NOT, traversal, relationExists,
 * projections) — callers should confirm with the user first in that case.
 */
export const entityQueryToBrowserFilters = (
  query: EntityQuery
): { conditions: FilterCondition[]; q: string } => {
  const conditions: FilterCondition[] = rootChildren(query)
    .filter(
      (node): node is Extract<EntityQuery['root'], { kind: 'predicate' }> =>
        node.kind === 'predicate' && node.path.length === 0
    )
    .map(({ fieldId, op, value }) => ({ fieldId, op, value }));
  if (query.schemaId && !conditions.some(c => c.fieldId === '_schemaId')) {
    conditions.push({ fieldId: '_schemaId', op: 'equals', value: query.schemaId });
  }
  return { conditions, q: freeTextFromEntityQuery(query) ?? '' };
};

export const parseJsonConfig = <T>(value: string | undefined): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const serializeConfig = <T>(value: T | null) => (value ? JSON.stringify(value) : undefined);

export const parseViewConfigs = (value: string | undefined): BrowserViewConfigMap => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as BrowserViewConfigMap;
  } catch {
    return {};
  }
};

export const serializeViewConfigs = (value: BrowserViewConfigMap): string | undefined => {
  const entries = Object.entries(value).filter(([, config]) => config != null);
  if (entries.length === 0) return undefined;
  return JSON.stringify(Object.fromEntries(entries));
};

const isAssessmentFieldId = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(ASSESSMENT_FIELD_PREFIX);

/**
 * Map's `metricConfig` isn't a scalar `xFieldId`-style key referencing an `_assessment*` id -
 * it's a nested `{ source: { kind, fieldId? } }` object, and "assessment-ness" is carried by
 * `source.kind` rather than a field-id prefix. An assessment-sourced metric can't function
 * without the join, so the whole `metricConfig` is cleared rather than just its field id.
 */
const isAssessmentSourcedMetricConfig = (value: unknown): boolean => {
  if (value == null || typeof value !== 'object') return false;
  const source = (value as { source?: unknown }).source;
  if (source == null || typeof source !== 'object') return false;
  const kind = (source as { kind?: unknown }).kind;
  return kind === 'assessmentRating' || kind === 'assessmentEnum';
};

/**
 * Strips references to the joined assessment's fields from filter conditions and view
 * configs. Called whenever the join is cleared or switched to a different assessment, so
 * stale `_assessment*` field ids never linger in the URL or a saved view.
 */
export const pruneAssessmentReferences = (
  conditions: FilterCondition[],
  viewConfigs: BrowserViewConfigMap
): { conditions: FilterCondition[]; viewConfigs: BrowserViewConfigMap } => {
  const prunedConditions = conditions.filter(c => !isAssessmentCondition(c));

  const prunedViewConfigs: BrowserViewConfigMap = {};
  for (const [view, config] of Object.entries(viewConfigs)) {
    if (config == null || typeof config !== 'object') {
      prunedViewConfigs[view as BrowserView] = config;
      continue;
    }
    const next: Record<string, unknown> = { ...(config as Record<string, unknown>) };
    if (Array.isArray(next.fieldIds)) {
      next.fieldIds = (next.fieldIds as unknown[]).filter(id => !isAssessmentFieldId(id));
    }
    if (isAssessmentFieldId(next.quadrantFieldId)) next.quadrantFieldId = '';
    if (isAssessmentFieldId(next.ringFieldId)) next.ringFieldId = '';
    if (isAssessmentFieldId(next.colEnumFieldId)) next.colEnumFieldId = null;
    if (isAssessmentFieldId(next.xFieldId)) next.xFieldId = '';
    if (isAssessmentFieldId(next.yFieldId)) next.yFieldId = '';
    if (isAssessmentFieldId(next.sizeFieldId)) next.sizeFieldId = null;
    if (isAssessmentFieldId(next.colorFieldId)) next.colorFieldId = null;
    if (isAssessmentSourcedMetricConfig(next.metricConfig)) next.metricConfig = null;
    prunedViewConfigs[view as BrowserView] = next;
  }

  return { conditions: prunedConditions, viewConfigs: prunedViewConfigs };
};

export const isTreeBasedView = (view: BrowserView): boolean => view === 'tree' || view === 'map';

export const getSavedViewConfig = (view: SavedView): unknown | null => {
  if (view.config == null) return null;
  if (view.viewMode === 'radar') return view.config.radar ?? null;
  if (view.viewMode === 'timeline') return view.config.timeline ?? null;
  if (view.viewMode === 'matrix') return view.config.matrix ?? null;
  if (view.viewMode === 'explore') return view.config.explore ?? null;
  if (view.viewMode === 'bubble') return view.config.bubble ?? null;
  if (view.viewMode === 'map') return view.config.map ?? null;
  if (view.viewMode === 'table') return view.config.table ?? null;
  if (view.viewMode === 'cards') return view.config.cards ?? null;
  if (view.viewMode === 'tree') return view.config.tree ?? null;
  return null;
};

export const toSavedViewSearch = (view: SavedView): Partial<BrowserSearch> => ({
  type: view.filters.schemaId ?? undefined,
  status: getFilterValue(filterConditionsFromEntityQuery(view.filters), '_lifecycle') ?? undefined,
  owner: getFilterValue(filterConditionsFromEntityQuery(view.filters), '_owner') ?? undefined,
  q: freeTextFromEntityQuery(view.filters),
  viewId: view.id,
  viewMode: view.viewMode,
  sort: view.config?.sort ?? undefined,
  projectScope: view.projectScope ?? undefined,
  viewConfigs: serializeViewConfigs(
    getSavedViewConfig(view) == null ? {} : { [view.viewMode]: getSavedViewConfig(view) }
  ),
  filters: undefined,
  entityQuery: JSON.stringify(view.filters)
});

export const getFilterValue = (conditions: FilterCondition[], fieldId: string) =>
  (conditions.find(c => c.fieldId === fieldId && c.op === 'equals')?.value as string) ?? null;

export const buildEntityQueryFromBrowserFilters = ({
  typeFilter,
  conditions,
  joinAssessmentId,
  q = ''
}: {
  typeFilter: string | null;
  conditions: FilterCondition[];
  joinAssessmentId?: string | null;
  q?: string;
}): EntityQuery => {
  const query: EntityQuery = {
    ...(typeFilter ? { schemaId: typeFilter } : {}),
    ...(joinAssessmentId ? { assessmentId: joinAssessmentId } : {}),
    root: {
      kind: 'and',
      children: conditions
        .filter(condition => condition.fieldId !== '_schemaId')
        .map(condition => ({
          kind: 'predicate' as const,
          path: [],
          fieldId: condition.fieldId,
          op: condition.op,
          value: condition.value
        }))
    }
  };
  return addFreeTextQuery(query, q);
};

export const toSavedViewConfig = (
  view: BrowserView,
  viewConfigs: BrowserViewConfigMap,
  sort?: string
): CreateSavedViewRequest['config'] => {
  const config = viewConfigs[view];
  const result: Record<string, unknown> = {};
  if (sort && sort !== 'name') result.sort = sort;
  if (config != null) {
    if (view === 'radar') result.radar = config;
    if (view === 'timeline') result.timeline = config;
    if (view === 'matrix') result.matrix = config;
    if (view === 'explore') result.explore = config;
    if (view === 'bubble') result.bubble = config;
    if (view === 'map') result.map = config;
    if (view === 'table') result.table = config;
    if (view === 'cards') result.cards = config;
    if (view === 'tree') result.tree = config;
  }
  return Object.keys(result).length > 0 ? (result as CreateSavedViewRequest['config']) : null;
};

export const buildSavedViewPayload = ({
  scope,
  projectId,
  projectScope,
  name,
  description,
  isAdminView,
  view,
  typeFilter,
  q,
  sort,
  conditions,
  viewConfigs,
  joinAssessmentId,
  entityQuery
}: {
  scope: 'workspace' | 'project';
  projectId?: string;
  projectScope?: 'project' | 'all';
  name: string;
  description: string;
  isAdminView?: boolean;
  view: BrowserView;
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  q: string;
  sort: string;
  conditions: FilterCondition[];
  viewConfigs: BrowserViewConfigMap;
  joinAssessmentId?: string | null;
  entityQuery?: EntityQuery | null;
}): CreateSavedViewRequest => {
  const resolvedEntityQuery =
    entityQuery ??
    buildEntityQueryFromBrowserFilters({ typeFilter, conditions, joinAssessmentId, q });
  const canonicalEntityQuery = addFreeTextQuery(resolvedEntityQuery, q);

  return {
    scope,
    projectId: scope === 'project' ? (projectId ?? null) : null,
    projectScope: scope === 'project' ? (projectScope ?? null) : null,
    name,
    description: description ?? null,
    isAdminView: isAdminView ?? false,
    viewMode: view,
    filters: canonicalEntityQuery,
    config: toSavedViewConfig(view, viewConfigs, sort)
  };
};
