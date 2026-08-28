import {
  defineSearchParamSchema,
  enumCodec,
  mapCodec,
  numberInRangeCodec,
  omitDefaultCodec,
  parseSearchParams,
  positivePageCodec,
  stringCodec,
  type SearchParamCodecOutput,
  type SearchParamsFromSchema
} from './searchParamCodecs';

const entityBrowserSidebarValues = enumCodec(['home', 'views', 'bookmarks', 'baselines'] as const);

export type EntityBrowserSidebarTab = SearchParamCodecOutput<typeof entityBrowserSidebarValues>;

const entityBrowserSidebarCodec = mapCodec(
  enumCodec([
    'home',
    'views',
    'bookmarks',
    'baselines',
    'filters',
    'pinned',
    'collections'
  ] as const),
  (value): EntityBrowserSidebarTab => {
    if (value === 'filters') return 'home';
    if (value === 'pinned' || value === 'collections') return 'bookmarks';
    return value;
  }
);

const sharedEntityBrowserSearchSchema = defineSearchParamSchema({
  type: stringCodec,
  status: stringCodec,
  owner: stringCodec,
  q: stringCodec,
  viewId: stringCodec,
  viewMode: enumCodec([
    'table',
    'cards',
    'tree',
    'radar',
    'timeline',
    'matrix',
    'explore',
    'bubble',
    'heatmap',
    'map',
    'diff',
    'graph',
    'traceability'
  ] as const),
  sort: stringCodec,
  projectScope: enumCodec(['project', 'all'] as const),
  viewConfigs: stringCodec,
  sidebarTab: entityBrowserSidebarCodec,
  baselineId: stringCodec,
  collectionId: stringCodec,
  filters: stringCodec,
  entityQuery: stringCodec,
  asOf: stringCodec,
  asOfIncludeProjects: enumCodec(['true', 'false'] as const),
  joinAssessmentId: stringCodec
});

export type SharedEntityBrowserSearchParams = SearchParamsFromSchema<
  typeof sharedEntityBrowserSearchSchema
>;

// Entity browser filters
export type EntitySearchParams = SharedEntityBrowserSearchParams;

export const validateEntitySearch = (raw: Record<string, unknown>): EntitySearchParams =>
  parseSearchParams(sharedEntityBrowserSearchSchema, raw);

// Relation browser params
const relationSearchSchema = defineSearchParamSchema({
  viewId: stringCodec,
  viewMode: enumCodec(['table', 'graph'] as const),
  entityQuery: stringCodec, // JSON string of structured EntityQuery IR (root_kind: 'relation')
  edgeLabelFieldId: stringCodec,
  edgeColorFieldId: stringCodec,
  // Distinct name from the model-overview route's own `typedRelationMode` (below) — `useSearch`
  // unions search params across routes, so a shared name would collide on type.
  relationGraphMode: enumCodec(['flat', 'entity'] as const),
  // JSON-encoded string[] — a saved view's config.table.fieldIds, restricting the Table view to a
  // curated column set (including `_projection:`-prefixed projected columns) instead of every
  // field on the active relation schema.
  tableFieldIds: stringCodec
});

export type RelationSearchParams = SearchParamsFromSchema<typeof relationSearchSchema>;

export const validateRelationSearch = (raw: Record<string, unknown>): RelationSearchParams =>
  parseSearchParams(relationSearchSchema, raw);

const sharedContentBrowserSearchSchema = defineSearchParamSchema({
  contentQuery: stringCodec,
  contentView: enumCodec(['grid', 'list'] as const)
});

export type SharedContentBrowserSearchParams = SearchParamsFromSchema<
  typeof sharedContentBrowserSearchSchema
>;

export type WorkspaceContentSearchParams = SharedContentBrowserSearchParams;

export const validateWorkspaceContentSearch = (
  raw: Record<string, unknown>
): WorkspaceContentSearchParams => parseSearchParams(sharedContentBrowserSearchSchema, raw);

// Entity detail params
const entityDetailSearchSchema = defineSearchParamSchema({
  ...sharedContentBrowserSearchSchema,
  sidebarTab: entityBrowserSidebarCodec,
  collectionId: stringCodec,
  apiQ: stringCodec,
  apiResource: stringCodec,
  apiAction: stringCodec,
  apiTag: stringCodec,
  apiDeprecated: enumCodec(['true', 'false'] as const),
  apiPage: positivePageCodec,
  apiArtifactId: stringCodec,
  apiRevisionId: stringCodec,
  // Most values are the fixed TabId set (api/topology/graph/relations/...); the rest are dynamic
  // per-schema detail-layout tab ids (see entityDetailTypes.ts), so this accepts any string.
  tab: stringCodec
});

export type EntityDetailSearchParams = SearchParamsFromSchema<typeof entityDetailSearchSchema>;

export const validateEntityDetailSearch = (
  raw: Record<string, unknown>
): EntityDetailSearchParams => parseSearchParams(entityDetailSearchSchema, raw);

const markdownSearchSchema = defineSearchParamSchema({
  commentId: stringCodec,
  draftName: stringCodec,
  draftFolder: stringCodec,
  draftType: stringCodec,
  draftTemplate: stringCodec,
  mode: enumCodec(['edit', 'preview'] as const),
  panel: enumCodec(['preview', 'history'] as const),
  revisionId: stringCodec,
  historyMode: enumCodec(['preview', 'compare'] as const),
  compareMode: enumCodec(['to-current', 'changes-in-version'] as const),
  diagramSessionId: stringCodec
});

export type MarkdownSearchParams = SearchParamsFromSchema<typeof markdownSearchSchema>;

export const validateMarkdownSearch = (raw: Record<string, unknown>): MarkdownSearchParams =>
  parseSearchParams(markdownSearchSchema, raw);

// Project detail params
const projectSearchSchema = defineSearchParamSchema({
  ...sharedEntityBrowserSearchSchema,
  ...sharedContentBrowserSearchSchema,
  tab: enumCodec(['projects', 'archive'] as const),
  section: enumCodec(['home', 'entities', 'assessments', 'milestones'] as const),
  assessmentId: stringCodec,
  assessmentTab: enumCodec(['details', 'summary', 'discussion'] as const),
  dialog: enumCodec(['add-entity'] as const)
});

export type ProjectSearchParams = SearchParamsFromSchema<typeof projectSearchSchema>;

export const validateProjectSearch = (raw: Record<string, unknown>): ProjectSearchParams =>
  parseSearchParams(projectSearchSchema, raw);

// Settings params
const settingsSearchSchema = defineSearchParamSchema({
  auditEntityType: stringCodec,
  auditOperation: enumCodec(['create', 'update', 'delete'] as const),
  auditStartDate: stringCodec,
  auditEndDate: stringCodec,
  analyticsView: enumCodec(['stale'] as const)
});

export type SettingsSearchParams = SearchParamsFromSchema<typeof settingsSearchSchema>;

export const validateSettingsSearch = (raw: Record<string, unknown>): SettingsSearchParams =>
  parseSearchParams(settingsSearchSchema, raw);

// Legacy `?section=` support for the bare `/settings` redirect route
const legacySettingsSearchSchema = defineSearchParamSchema({
  ...settingsSearchSchema,
  section: stringCodec
});

export type LegacySettingsSearchParams = SearchParamsFromSchema<typeof legacySettingsSearchSchema>;

export const validateLegacySettingsSearch = (
  raw: Record<string, unknown>
): LegacySettingsSearchParams => parseSearchParams(legacySettingsSearchSchema, raw);

// Account settings params
const accountSettingsSearchSchema = defineSearchParamSchema({
  section: stringCodec
});

export type AccountSettingsSearchParams = SearchParamsFromSchema<
  typeof accountSettingsSearchSchema
>;

export const validateAccountSettingsSearch = (
  raw: Record<string, unknown>
): AccountSettingsSearchParams => parseSearchParams(accountSettingsSearchSchema, raw);

// Search params
const searchRouteSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  category: enumCodec(['all', 'entities', 'projects', 'files', 'schemas', 'relations'] as const)
});

export type SearchRouteSearchParams = SearchParamsFromSchema<typeof searchRouteSearchSchema>;

export const validateSearchSearch = (raw: Record<string, unknown>): SearchRouteSearchParams =>
  parseSearchParams(searchRouteSearchSchema, raw);

// Diagram params
const diagramSearchSchema = defineSearchParamSchema({
  returnTo: stringCodec,
  markdownSessionId: stringCodec
});

export type DiagramSearchParams = SearchParamsFromSchema<typeof diagramSearchSchema>;

export const validateDiagramSearch = (raw: Record<string, unknown>): DiagramSearchParams =>
  parseSearchParams(diagramSearchSchema, raw);

// Data model params
const modelSearchSchema = defineSearchParamSchema({
  tab: enumCodec(['types', 'enums', 'graph'] as const),
  schema: stringCodec,
  enumId: stringCodec
});

export type ModelSearchParams = SearchParamsFromSchema<typeof modelSearchSchema>;

export const validateModelSearch = (raw: Record<string, unknown>): ModelSearchParams =>
  parseSearchParams(modelSearchSchema, raw);

// Schema settings params (for settings/schemas route)
const schemaSettingsSearchSchema = defineSearchParamSchema({
  tab: enumCodec(['types', 'enums', 'fieldgroups', 'relation-types'] as const),
  schema: stringCodec,
  enumId: stringCodec,
  fieldGroupId: stringCodec,
  relationSchema: stringCodec
});

export type SchemaSettingsSearchParams = SearchParamsFromSchema<typeof schemaSettingsSearchSchema>;

export const validateSchemaSettingsSearch = (
  raw: Record<string, unknown>
): SchemaSettingsSearchParams => parseSearchParams(schemaSettingsSearchSchema, raw);

// Document settings params (for settings/documents route)
const documentSettingsSearchSchema = defineSearchParamSchema({
  tab: enumCodec(['types', 'templates'] as const),
  type: stringCodec,
  template: stringCodec
});

export type DocumentSettingsSearchParams = SearchParamsFromSchema<
  typeof documentSettingsSearchSchema
>;

export const validateDocumentSettingsSearch = (
  raw: Record<string, unknown>
): DocumentSettingsSearchParams => parseSearchParams(documentSettingsSearchSchema, raw);

const modelOverviewSearchSchema = defineSearchParamSchema({
  layout: omitDefaultCodec(
    enumCodec(['hierarchy', 'layered', 'force', 'tree'] as const),
    'hierarchy'
  ),
  horizontalSpacing: numberInRangeCodec({ min: 50, max: 500, defaultValue: 200 }),
  verticalSpacing: numberInRangeCodec({ min: 50, max: 300, defaultValue: 108 }),
  crossingMinimizationIterations: numberInRangeCodec({
    min: 1,
    max: 50,
    defaultValue: 10,
    integer: true
  }),
  iterations: numberInRangeCodec({ min: 50, max: 1000, defaultValue: 300, integer: true }),
  springStrength: numberInRangeCodec({ min: 0.1, max: 2.0, defaultValue: 0.5 }),
  repulsionStrength: numberInRangeCodec({ min: 0.1, max: 3.0, defaultValue: 1.0 }),
  idealEdgeLength: numberInRangeCodec({ min: 50, max: 500, defaultValue: 160 }),
  categoryStates: stringCodec,
  typedRelationMode: omitDefaultCodec(enumCodec(['entity', 'reference'] as const), 'entity')
});

export type ModelOverviewSearchParams = SearchParamsFromSchema<typeof modelOverviewSearchSchema>;

export const validateModelOverviewSearch = (
  raw: Record<string, unknown>
): ModelOverviewSearchParams => parseSearchParams(modelOverviewSearchSchema, raw);

// Assistant params
const assistantSearchSchema = defineSearchParamSchema({
  conversation: stringCodec,
  layout: enumCodec(['conversation', 'split'] as const)
});

export type AssistantSearchParams = SearchParamsFromSchema<typeof assistantSearchSchema>;

export const validateAssistantSearch = (raw: Record<string, unknown>): AssistantSearchParams =>
  parseSearchParams(assistantSearchSchema, raw);

// Glossary params
const glossarySearchSchema = defineSearchParamSchema({
  q: stringCodec,
  categoryIds: stringCodec, // comma-joined TermCategory entity ids
  quality: enumCodec(['unused', 'conflicting', 'deprecated', 'ownerless'] as const),
  owner: stringCodec,
  lifecycle: stringCodec
});

export type GlossarySearchParams = SearchParamsFromSchema<typeof glossarySearchSchema>;

export const validateGlossarySearch = (raw: Record<string, unknown>): GlossarySearchParams =>
  parseSearchParams(glossarySearchSchema, raw);

// Home params
const homeSearchSchema = defineSearchParamSchema({
  dashboard: stringCodec
});

export type HomeSearchParams = SearchParamsFromSchema<typeof homeSearchSchema>;

export const validateHomeSearch = (raw: Record<string, unknown>): HomeSearchParams =>
  parseSearchParams(homeSearchSchema, raw);
