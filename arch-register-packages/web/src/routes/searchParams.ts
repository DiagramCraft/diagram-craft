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

// Shared across every workspace screen (declared on the parent `$workspaceSlug` route) so an
// entity drawer can be opened/closed without a per-screen route param — see useEntityDrawer.ts.
const entityDrawerSearchParamSchema = defineSearchParamSchema({
  drawer: stringCodec
});

export type EntityDrawerSearchParams = SearchParamsFromSchema<typeof entityDrawerSearchParamSchema>;

export const validateEntityDrawerSearch = (
  raw: Record<string, unknown>
): EntityDrawerSearchParams => parseSearchParams(entityDrawerSearchParamSchema, raw);

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
    'traceability',
    'path-walker'
  ] as const),
  sort: stringCodec,
  projectScope: enumCodec(['project', 'all'] as const),
  viewConfigs: stringCodec,
  // Comma-separated entity ids, one per path-walker column, tracking the currently walked chain.
  pathWalk: stringCodec,
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

// Applications & Capabilities settings params (for settings/applications-capabilities route)
const applicationsCapabilitiesSearchSchema = defineSearchParamSchema({
  // Selected sidebar entry: a managed application id or a bare capability type.
  item: stringCodec,
  // Active tab within the selected entry: bindings | fields | dashboard | access.
  tab: stringCodec
});

export type ApplicationsCapabilitiesSearchParams = SearchParamsFromSchema<
  typeof applicationsCapabilitiesSearchSchema
>;

export const validateApplicationsCapabilitiesSearch = (
  raw: Record<string, unknown>
): ApplicationsCapabilitiesSearchParams =>
  parseSearchParams(applicationsCapabilitiesSearchSchema, raw);

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

// Strategy capabilities params
const capabilitiesSearchSchema = defineSearchParamSchema({
  level: stringCodec, // e.g. 'L1', 'L2'
  owner: stringCodec,
  // Set by clicking a node in the sidebar's capability tree; filters the table to that
  // capability's id plus its descendants.
  subtreeOf: stringCodec
});

export type CapabilitiesSearchParams = SearchParamsFromSchema<typeof capabilitiesSearchSchema>;

export const validateCapabilitiesSearch = (
  raw: Record<string, unknown>
): CapabilitiesSearchParams => parseSearchParams(capabilitiesSearchSchema, raw);

// Vendor Management vendors params — the facets' dashboard sidebar variables (see the
// `vendor-management-vendors` seed in `appDashboardSeeds.ts`), each a comma-joined value list.
const vendorsSearchSchema = defineSearchParamSchema({
  tiers: stringCodec,
  categories: stringCodec,
  relationshipOwners: stringCodec
});

export type VendorsSearchParams = SearchParamsFromSchema<typeof vendorsSearchSchema>;

export const validateVendorsSearch = (raw: Record<string, unknown>): VendorsSearchParams =>
  parseSearchParams(vendorsSearchSchema, raw);

// Vendor Management contracts params
const contractsSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  // Contract Type select-field value, a Vendor uid, and a RenewalWindow id — set by the sidebar's
  // facets (`ContractsSidebarContent` in `VendorManagementSidebar.tsx`).
  type: stringCodec,
  vendor: stringCodec,
  renewalWindow: stringCodec,
  // Toggles the section between its list, 12-month renewal calendar, and Gantt-style contract
  // timeline; defaults to 'list'.
  view: enumCodec(['list', 'calendar', 'timeline'] as const)
});

export type ContractsSearchParams = SearchParamsFromSchema<typeof contractsSearchSchema>;

export const validateContractsSearch = (raw: Record<string, unknown>): ContractsSearchParams =>
  parseSearchParams(contractsSearchSchema, raw);

// Vendor Management spend params
const spendSearchSchema = defineSearchParamSchema({
  // Toggles the roll-up table's grouping dimension; defaults to 'vendor'. 'capability' is
  // selectable (matching the design reference's three-way toggle) but shows an explanatory empty
  // state instead of data — no Contract-to-capability schema link exists yet, see
  // `VendorSpendScreen.tsx`.
  group: enumCodec(['vendor', 'costCentre', 'capability'] as const),
  // Vendor Cost Centre select-field value and a Relationship Owner free-text value — set by the
  // sidebar's facets (`SpendSidebarContent` in `VendorManagementSidebar.tsx`), narrowing the
  // vendor/capability roll-ups to a single cost centre or owner (ignored when already grouped by
  // cost centre, matching the design reference).
  cc: stringCodec,
  owner: stringCodec
});

export type SpendSearchParams = SearchParamsFromSchema<typeof spendSearchSchema>;

export const validateSpendSearch = (raw: Record<string, unknown>): SpendSearchParams =>
  parseSearchParams(spendSearchSchema, raw);

// Vendor Management risk params
const riskSearchSchema = defineSearchParamSchema({
  // Vendor risk band, narrowing the matrix, risk register, and EOL table to vendors in that band
  // — set by the sidebar's Band facet (`RiskSidebarContent` in `VendorManagementSidebar.tsx`).
  band: stringCodec,
  // A `GroupedVendorTechnologyExposure.key` (`<vendorUid>:<technologyReleaseUid>`), narrowing the
  // matrix, risk register, and EOL table down to that one vendor — set by the sidebar's
  // Technology EOL facet. Combines (AND) with `band` rather than replacing it.
  technology: stringCodec
});

export type RiskSearchParams = SearchParamsFromSchema<typeof riskSearchSchema>;

export const validateRiskSearch = (raw: Record<string, unknown>): RiskSearchParams =>
  parseSearchParams(riskSearchSchema, raw);

// Risk & Compliance risks params — the facets' dashboard sidebar variables (see the
// `risk-compliance-risks` seed in `appDashboardSeeds.ts`), each a comma-joined value list, plus
// the active tab of the Register/Matrix tabs widget.
const risksSearchSchema = defineSearchParamSchema({
  categories: stringCodec,
  statuses: stringCodec,
  owners: stringCodec,
  tab: stringCodec
});

export type RisksSearchParams = SearchParamsFromSchema<typeof risksSearchSchema>;

export const validateRisksSearch = (raw: Record<string, unknown>): RisksSearchParams =>
  parseSearchParams(risksSearchSchema, raw);

// Risk & Compliance controls params — the facets' dashboard sidebar variables (see the
// `risk-compliance-controls` seed in `appDashboardSeeds.ts`), each a comma-joined value list, plus
// the active tab of the Library/Coverage/Traceability tabs widget.
const controlsSearchSchema = defineSearchParamSchema({
  types: stringCodec,
  effectiveness: stringCodec,
  tab: stringCodec
});

export type ControlsSearchParams = SearchParamsFromSchema<typeof controlsSearchSchema>;

export const validateControlsSearch = (raw: Record<string, unknown>): ControlsSearchParams =>
  parseSearchParams(controlsSearchSchema, raw);

// Risk & Compliance assessments params
const assessmentsSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  // Narrows the register to assessments scoped to the Risk schema or the Control schema; unset
  // shows both — set by the section's own Risk/Control/All toggle.
  type: enumCodec(['risk', 'control'] as const)
});

export type AssessmentsSearchParams = SearchParamsFromSchema<typeof assessmentsSearchSchema>;

export const validateAssessmentsSearch = (raw: Record<string, unknown>): AssessmentsSearchParams =>
  parseSearchParams(assessmentsSearchSchema, raw);

// Risk & Compliance retention params. The section is a dashboard (`risk-compliance-retention`
// seed in `appDashboardSeeds.ts`) whose `entity-picker` sidebar narrows the assignments register to
// one Retention Policy via this variable-named param (`resolveSidebarVariableReferences.ts`).
const retentionSearchSchema = defineSearchParamSchema({
  policyId: stringCodec
});

export type RetentionSearchParams = SearchParamsFromSchema<typeof retentionSearchSchema>;

export const validateRetentionSearch = (raw: Record<string, unknown>): RetentionSearchParams =>
  parseSearchParams(retentionSearchSchema, raw);

// Strategy capability map params
const capabilityMapSearchSchema = defineSearchParamSchema({
  // Set by clicking a node in the map sidebar's capability tree (or an L1 domain header in the
  // grid); collapses the grid to that capability's subtree, with an "All domains" affordance to
  // clear it.
  focus: stringCodec,
  // Team id; dims map tiles whose capability is not owned by that team (same "dim, don't remove"
  // semantics as the grid's free-text search box).
  owner: stringCodec
});

export type CapabilityMapSearchParams = SearchParamsFromSchema<typeof capabilityMapSearchSchema>;

export const validateCapabilityMapSearch = (
  raw: Record<string, unknown>
): CapabilityMapSearchParams => parseSearchParams(capabilityMapSearchSchema, raw);

// Strategy traceability params — the hop walker's column selection lives in the URL so a walked
// Objective → Capability → Application path is deep-linkable, mirroring `focus` on the capability
// map.
const traceabilitySearchSchema = defineSearchParamSchema({
  // 'chain' (the hop walker, default) | 'orphans' (the "no strategy link" list).
  tab: stringCodec,
  objective: stringCodec,
  capability: stringCodec
});

export type TraceabilitySearchParams = SearchParamsFromSchema<typeof traceabilitySearchSchema>;

export const validateTraceabilitySearch = (
  raw: Record<string, unknown>
): TraceabilitySearchParams => parseSearchParams(traceabilitySearchSchema, raw);

// Strategy section params — the selected objective card lives in the URL so an objective's
// outcomes / initiatives / measures view is deep-linkable, and the sidebar's objective list can
// drive the same selection.
const strategySearchSchema = defineSearchParamSchema({
  objective: stringCodec
});

export type StrategySearchParams = SearchParamsFromSchema<typeof strategySearchSchema>;

export const validateStrategySearch = (raw: Record<string, unknown>): StrategySearchParams =>
  parseSearchParams(strategySearchSchema, raw);

// Home params
const homeSearchSchema = defineSearchParamSchema({
  dashboard: stringCodec
});

export type HomeSearchParams = SearchParamsFromSchema<typeof homeSearchSchema>;

export const validateHomeSearch = (raw: Record<string, unknown>): HomeSearchParams =>
  parseSearchParams(homeSearchSchema, raw);

// Data Stewardship classification-section params. Three views (classified data / restricted flows
// / cross-boundary transfers) live in one screen, switched via the sidebar's own TreeRows
// (`ClassificationSidebarContent` in `../app/data-stewardship/sections/DataStewardshipSidebar.tsx`)
// rather than a separate route per view — see `DataStewardshipClassificationScreen.tsx`'s doc
// comment for why.
const dataStewardshipClassificationSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  view: enumCodec(['classified', 'restricted-flows', 'cross-boundary'] as const),
  // Classification select-field value — narrows the classified-data view; mirrors
  // `dataStewardshipStewardshipSearchSchema`'s own `classification`.
  classification: stringCodec,
  // Narrows the classified-data view to entities flagged as carrying personal data
  // (`isPersonalData` in `../app/data-stewardship/dataFlowClassification.ts`); '1' when set,
  // absent otherwise.
  personalDataOnly: enumCodec(['1'] as const),
  // Narrows the classified-data view to datasets with a coverage gap (`computeDatasetCoverage`);
  // '1' when set, absent otherwise — mirrors `dataStewardshipStewardshipSearchSchema`'s own
  // `gapsOnly`.
  gapsOnly: enumCodec(['1'] as const),
  // Sort keys differ per view ('classification' | 'name' for classified data, 'severity' | 'name'
  // for the flow views), so this is a loose string rather than a per-view enum union.
  sort: stringCodec
});

export type DataStewardshipClassificationSearchParams = SearchParamsFromSchema<
  typeof dataStewardshipClassificationSearchSchema
>;

export const validateDataStewardshipClassificationSearch = (
  raw: Record<string, unknown>
): DataStewardshipClassificationSearchParams =>
  parseSearchParams(dataStewardshipClassificationSearchSchema, raw);

// Data Stewardship My work-section params — the review queue that's also the app's landing screen
// (`DataStewardshipDashboardScreen.tsx`, #3298/#3501).
const dataStewardshipMyWorkSearchSchema = defineSearchParamSchema({
  // Opens the new minimal case drawer (`GovernanceCaseDrawer.tsx`) for this governance case id
  // — for entity.change-case / entity.deprecation queue rows.
  caseId: stringCodec,
  // Opens the shared entity drawer for this dataset id (paired with `caseId` above, so a click
  // between the two swaps rather than stacks) — for field-date-reminder queue rows.
  datasetId: stringCodec
});

export type DataStewardshipMyWorkSearchParams = SearchParamsFromSchema<
  typeof dataStewardshipMyWorkSearchSchema
>;

export const validateDataStewardshipMyWorkSearch = (
  raw: Record<string, unknown>
): DataStewardshipMyWorkSearchParams => parseSearchParams(dataStewardshipMyWorkSearchSchema, raw);

// API & Integration Catalog integrations-section params — facets set by the sidebar's
// `IntegrationsSidebarContent` (`ApiIntegrationCatalogSidebar.tsx`), mirrors `risksSearchSchema`'s
// facet params above.
const apiIntegrationCatalogIntegrationsSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  // `protocol` / `data_classification` select-field values on the Data Flow relation schema.
  protocol: stringCodec,
  classification: stringCodec,
  // Narrows to relations whose derived `cross_boundary` field is `'cross-boundary'`. '1' when set,
  // absent otherwise, mirrors `risksSearchSchema`'s `outsideAppetite`.
  boundary: enumCodec(['1'] as const),
  // Toggles the table between the Data Flow relation list ('flows', the default — undefined) and
  // the lighter Provider/Consumer Pairs table (#3340).
  view: enumCodec(['flows', 'pairs'] as const)
});

export type ApiIntegrationCatalogIntegrationsSearchParams = SearchParamsFromSchema<
  typeof apiIntegrationCatalogIntegrationsSearchSchema
>;

export const validateApiIntegrationCatalogIntegrationsSearch = (
  raw: Record<string, unknown>
): ApiIntegrationCatalogIntegrationsSearchParams =>
  parseSearchParams(apiIntegrationCatalogIntegrationsSearchSchema, raw);

// API & Integration Catalog apis-section params — facets set by the sidebar's
// `ApisSidebarContent` (`ApiIntegrationCatalogSidebar.tsx`), mirrors
// `apiIntegrationCatalogIntegrationsSearchSchema` above (#3345).
const apiIntegrationCatalogApisSearchSchema = defineSearchParamSchema({
  q: stringCodec,
  // `protocols` select-field value on the `api` entity schema (multi-value field; an API matches
  // when this value is one of its `protocols`).
  protocol: stringCodec,
  // `entity._lifecycle.id` — workspace lifecycle-state id.
  lifecycle: stringCodec,
  // `entity._owner.id` — owning team/user id. No schema lookup; values come from observed owners.
  owner: stringCodec,
  // Switches between the APIs catalog table (the default, undefined) and two flat cross-API
  // tables: every operation ('operations', #3345) or just the deprecated ones ('deprecated',
  // #3347 — deferred from #3345 after the projection fan-out surfaced a 409 from the artifacts
  // revisions endpoint, now fixed server-side).
  view: enumCodec(['catalog', 'operations', 'deprecated'] as const)
});

export type ApiIntegrationCatalogApisSearchParams = SearchParamsFromSchema<
  typeof apiIntegrationCatalogApisSearchSchema
>;

export const validateApiIntegrationCatalogApisSearch = (
  raw: Record<string, unknown>
): ApiIntegrationCatalogApisSearchParams =>
  parseSearchParams(apiIntegrationCatalogApisSearchSchema, raw);
