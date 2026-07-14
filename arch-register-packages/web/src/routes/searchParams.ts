export type SharedEntityBrowserSearchParams = {
  type?: string;
  status?: string;
  owner?: string;
  q?: string;
  viewId?: string;
  viewMode?: 'table' | 'cards' | 'tree' | 'radar' | 'timeline' | 'matrix' | 'hierarchy' | 'explore' | 'bubble';
  sort?: string;
  projectScope?: 'project' | 'all';
  viewConfigs?: string;
  sidebarTab?: 'filters' | 'views' | 'bookmarks';
  collectionId?: string;
  filters?: string; // JSON string of FilterCondition[]
  asOf?: string; // ISO 8601 date — when set, browser enters read-only point-in-time snapshot mode
  asOfIncludeProjects?: 'true' | 'false'; // whether asOf reconstruction applies project future_update snapshots; defaults to 'true'
  joinAssessmentId?: string; // joined assessment identifier for display, filtering, and view attributes
};

const validateSharedEntityBrowserSearch = (
  raw: Record<string, unknown>
): SharedEntityBrowserSearchParams => ({
  type: typeof raw.type === 'string' ? raw.type : undefined,
  status: typeof raw.status === 'string' ? raw.status : undefined,
  owner: typeof raw.owner === 'string' ? raw.owner : undefined,
  q: typeof raw.q === 'string' ? raw.q : undefined,
  viewId: typeof raw.viewId === 'string' ? raw.viewId : undefined,
  viewMode:
    raw.viewMode === 'table' ||
    raw.viewMode === 'cards' ||
    raw.viewMode === 'tree' ||
    raw.viewMode === 'radar' ||
    raw.viewMode === 'timeline' ||
    raw.viewMode === 'matrix' ||
    raw.viewMode === 'hierarchy' ||
    raw.viewMode === 'explore' ||
    raw.viewMode === 'bubble'
      ? raw.viewMode
      : undefined,
  sort: typeof raw.sort === 'string' ? raw.sort : undefined,
  projectScope: raw.projectScope === 'project' || raw.projectScope === 'all' ? raw.projectScope : undefined,
  viewConfigs: typeof raw.viewConfigs === 'string' ? raw.viewConfigs : undefined,
  sidebarTab:
    raw.sidebarTab === 'filters' ||
    raw.sidebarTab === 'views' ||
    raw.sidebarTab === 'bookmarks'
      ? raw.sidebarTab
      : raw.sidebarTab === 'pinned' || raw.sidebarTab === 'collections'
        ? 'bookmarks'
      : undefined,
  collectionId: typeof raw.collectionId === 'string' ? raw.collectionId : undefined,
  filters: typeof raw.filters === 'string' ? raw.filters : undefined,
  asOf: typeof raw.asOf === 'string' ? raw.asOf : undefined,
  asOfIncludeProjects:
    raw.asOfIncludeProjects === 'true' || raw.asOfIncludeProjects === 'false'
      ? raw.asOfIncludeProjects
      : undefined,
  joinAssessmentId: typeof raw.joinAssessmentId === 'string' ? raw.joinAssessmentId : undefined,
});

// Entity browser filters
export type EntitySearchParams = SharedEntityBrowserSearchParams;

export const validateEntitySearch = (raw: Record<string, unknown>): EntitySearchParams =>
  validateSharedEntityBrowserSearch(raw);

// Entity detail params
export type EntityDetailSearchParams = {
  contentQuery?: string;
  contentView?: 'grid' | 'list';
  sidebarTab?: SharedEntityBrowserSearchParams['sidebarTab'];
  collectionId?: string;
  tab?:
    | 'overview'
    | 'topology'
    | 'graph'
    | 'relations'
    | 'dependents'
    | 'assessments'
    | 'discussions'
    | 'changes'
    | 'timeline';
};

export type SharedContentBrowserSearchParams = {
  contentQuery?: string;
  contentView?: 'grid' | 'list';
};

const validateSharedContentBrowserSearch = (
  raw: Record<string, unknown>
): SharedContentBrowserSearchParams => ({
  contentQuery: typeof raw.contentQuery === 'string' ? raw.contentQuery : undefined,
  contentView: raw.contentView === 'grid' || raw.contentView === 'list' ? raw.contentView : undefined,
});

export type WorkspaceContentSearchParams = SharedContentBrowserSearchParams;

export const validateWorkspaceContentSearch = (
  raw: Record<string, unknown>
): WorkspaceContentSearchParams => validateSharedContentBrowserSearch(raw);

export const validateEntityDetailSearch = (raw: Record<string, unknown>): EntityDetailSearchParams => ({
  ...validateSharedContentBrowserSearch(raw),
  sidebarTab: validateSharedEntityBrowserSearch(raw).sidebarTab,
  collectionId: typeof raw.collectionId === 'string' ? raw.collectionId : undefined,
  tab:
    raw.tab === 'overview' ||
    raw.tab === 'topology' ||
    raw.tab === 'graph' ||
    raw.tab === 'relations' ||
    raw.tab === 'dependents' ||
    raw.tab === 'assessments' ||
    raw.tab === 'discussions' ||
    raw.tab === 'changes' ||
    raw.tab === 'timeline'
      ? raw.tab
      : undefined,
});

export type MarkdownSearchParams = {
  mode?: 'edit' | 'preview';
  panel?: 'preview' | 'history';
  revisionId?: string;
  historyMode?: 'preview' | 'compare';
  compareMode?: 'to-current' | 'changes-in-version';
  diagramSessionId?: string;
};

export const validateMarkdownSearch = (raw: Record<string, unknown>): MarkdownSearchParams => ({
  mode: raw.mode === 'edit' || raw.mode === 'preview' ? raw.mode : undefined,
  panel: raw.panel === 'preview' || raw.panel === 'history' ? raw.panel : undefined,
  revisionId: typeof raw.revisionId === 'string' ? raw.revisionId : undefined,
  historyMode: raw.historyMode === 'preview' || raw.historyMode === 'compare' ? raw.historyMode : undefined,
  compareMode: raw.compareMode === 'to-current' || raw.compareMode === 'changes-in-version' ? raw.compareMode : undefined,
  diagramSessionId: typeof raw.diagramSessionId === 'string' ? raw.diagramSessionId : undefined,
});

// Project detail params
export type ProjectSearchParams = {
  tab?: 'projects' | 'archive';
  section?: 'home' | 'entities' | 'assessments';
  assessmentId?: string;
  assessmentTab?: 'details' | 'summary' | 'discussion';
  dialog?: 'add-entity';
} & SharedEntityBrowserSearchParams & SharedContentBrowserSearchParams;

export const validateProjectSearch = (raw: Record<string, unknown>): ProjectSearchParams => ({
  ...validateSharedEntityBrowserSearch(raw),
  ...validateSharedContentBrowserSearch(raw),
  tab: raw.tab === 'projects' || raw.tab === 'archive' ? raw.tab : undefined,
  section:
    raw.section === 'home' || raw.section === 'entities' || raw.section === 'assessments'
      ? raw.section
      : undefined,
  assessmentId: typeof raw.assessmentId === 'string' ? raw.assessmentId : undefined,
  assessmentTab:
    raw.assessmentTab === 'details' || raw.assessmentTab === 'summary' || raw.assessmentTab === 'discussion'
      ? raw.assessmentTab
      : undefined,
  dialog: raw.dialog === 'add-entity' ? raw.dialog : undefined,
});

// Settings params
export type SettingsSearchParams = {
  auditEntityType?: string;
  auditOperation?: 'create' | 'update' | 'delete';
  auditStartDate?: string;
  auditEndDate?: string;
  analyticsView?: 'stale';
};

export const validateSettingsSearch = (raw: Record<string, unknown>): SettingsSearchParams => ({
  auditEntityType: typeof raw.auditEntityType === 'string' ? raw.auditEntityType : undefined,
  auditOperation:
    raw.auditOperation === 'create' || raw.auditOperation === 'update' || raw.auditOperation === 'delete'
      ? raw.auditOperation
      : undefined,
  auditStartDate: typeof raw.auditStartDate === 'string' ? raw.auditStartDate : undefined,
  auditEndDate: typeof raw.auditEndDate === 'string' ? raw.auditEndDate : undefined,
  analyticsView: raw.analyticsView === 'stale' ? raw.analyticsView : undefined
});

// Legacy `?section=` support for the bare `/settings` redirect route
export type LegacySettingsSearchParams = SettingsSearchParams & { section?: string };

export const validateLegacySettingsSearch = (
  raw: Record<string, unknown>
): LegacySettingsSearchParams => ({
  ...validateSettingsSearch(raw),
  section: typeof raw.section === 'string' ? raw.section : undefined
});

// Account settings params
export type AccountSettingsSearchParams = {
  section?: string;
};

export const validateAccountSettingsSearch = (
  raw: Record<string, unknown>
): AccountSettingsSearchParams => ({
  section: typeof raw.section === 'string' ? raw.section : undefined
});

// Search params
export type SearchRouteSearchParams = {
  q?: string;
  category?: 'all' | 'entities' | 'projects' | 'files' | 'schemas';
};

export const validateSearchSearch = (raw: Record<string, unknown>): SearchRouteSearchParams => ({
  q: typeof raw.q === 'string' ? raw.q : undefined,
  category:
    raw.category === 'all' ||
    raw.category === 'entities' ||
    raw.category === 'projects' ||
    raw.category === 'files' ||
    raw.category === 'schemas'
      ? raw.category
      : undefined,
});

// Diagram params
export type DiagramSearchParams = {
  returnTo?: string;
  markdownSessionId?: string;
};

export const validateDiagramSearch = (raw: Record<string, unknown>): DiagramSearchParams => ({
  returnTo: typeof raw.returnTo === 'string' ? raw.returnTo : undefined,
  markdownSessionId: typeof raw.markdownSessionId === 'string' ? raw.markdownSessionId : undefined,
});

// Data model params
export type ModelSearchParams = {
  tab?: 'types' | 'enums' | 'graph';
  schema?: string;
  enumId?: string;
};

export const validateModelSearch = (raw: Record<string, unknown>): ModelSearchParams => ({
  tab: raw.tab === 'types' || raw.tab === 'enums' || raw.tab === 'graph' ? raw.tab : undefined,
  schema: typeof raw.schema === 'string' ? raw.schema : undefined,
  enumId: typeof raw.enumId === 'string' ? raw.enumId : undefined,
});

// Schema settings params (for settings/schemas route)
export type SchemaSettingsSearchParams = {
  tab?: 'types' | 'enums';
  schema?: string;
  enumId?: string;
};

export const validateSchemaSettingsSearch = (raw: Record<string, unknown>): SchemaSettingsSearchParams => ({
  tab: raw.tab === 'types' || raw.tab === 'enums' ? raw.tab : undefined,
  schema: typeof raw.schema === 'string' ? raw.schema : undefined,
  enumId: typeof raw.enumId === 'string' ? raw.enumId : undefined,
});

export type ModelOverviewSearchParams = {
  layout?: 'hierarchy' | 'layered' | 'force' | 'tree';
  horizontalSpacing?: number;
  verticalSpacing?: number;
  crossingMinimizationIterations?: number;
  iterations?: number;
  springStrength?: number;
  repulsionStrength?: number;
  idealEdgeLength?: number;
};

const parseNumberInRange = (
  value: unknown,
  min: number,
  max: number,
  defaultValue: number,
  integer = false
): number | undefined => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) return undefined;
  if (integer && !Number.isInteger(parsed)) return undefined;
  if (parsed < min || parsed > max) return undefined;
  return parsed === defaultValue ? undefined : parsed;
};

export const validateModelOverviewSearch = (
  raw: Record<string, unknown>
): ModelOverviewSearchParams => ({
  layout:
    raw.layout === 'hierarchy' ||
    raw.layout === 'layered' ||
    raw.layout === 'force' ||
    raw.layout === 'tree'
      ? raw.layout === 'hierarchy'
        ? undefined
        : raw.layout
      : undefined,
  horizontalSpacing: parseNumberInRange(raw.horizontalSpacing, 50, 500, 200),
  verticalSpacing: parseNumberInRange(raw.verticalSpacing, 50, 300, 108),
  crossingMinimizationIterations: parseNumberInRange(
    raw.crossingMinimizationIterations,
    1,
    50,
    10,
    true
  ),
  iterations: parseNumberInRange(raw.iterations, 50, 1000, 300, true),
  springStrength: parseNumberInRange(raw.springStrength, 0.1, 2.0, 0.5),
  repulsionStrength: parseNumberInRange(raw.repulsionStrength, 0.1, 3.0, 1.0),
  idealEdgeLength: parseNumberInRange(raw.idealEdgeLength, 50, 500, 160),
});

// Assistant params
export type AssistantSearchParams = {
  conversation?: string;
  layout?: 'conversation' | 'split';
};

export const validateAssistantSearch = (raw: Record<string, unknown>): AssistantSearchParams => ({
  conversation: typeof raw.conversation === 'string' ? raw.conversation : undefined,
  layout: raw.layout === 'conversation' || raw.layout === 'split' ? raw.layout : undefined,
});
