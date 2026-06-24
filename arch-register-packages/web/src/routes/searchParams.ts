// Entity browser filters
export type EntitySearchParams = {
  type?: string;
  status?: string;
  owner?: string;
  q?: string;
  viewId?: string;
  viewMode?: 'table' | 'cards' | 'tree' | 'radar' | 'timeline' | 'matrix' | 'hierarchy' | 'explore';
  radarConfig?: string;
  timelineConfig?: string;
  matrixConfig?: string;
  hierarchyConfig?: string;
  exploreConfig?: string;
  sidebarTab?: 'filters' | 'views' | 'pinned';
  filters?: string; // JSON string of FilterCondition[]
};

export const validateEntitySearch = (raw: Record<string, unknown>): EntitySearchParams => ({
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
    raw.viewMode === 'explore'
      ? raw.viewMode
      : undefined,
  radarConfig: typeof raw.radarConfig === 'string' ? raw.radarConfig : undefined,
  timelineConfig: typeof raw.timelineConfig === 'string' ? raw.timelineConfig : undefined,
  matrixConfig: typeof raw.matrixConfig === 'string' ? raw.matrixConfig : undefined,
  hierarchyConfig: typeof raw.hierarchyConfig === 'string' ? raw.hierarchyConfig : undefined,
  exploreConfig: typeof raw.exploreConfig === 'string' ? raw.exploreConfig : undefined,
  sidebarTab: raw.sidebarTab === 'filters' || raw.sidebarTab === 'views' || raw.sidebarTab === 'pinned' ? raw.sidebarTab : undefined,
  filters: typeof raw.filters === 'string' ? raw.filters : undefined,
});

// Entity detail params
export type EntityDetailSearchParams = {
  contentFolder?: string;
};

export const validateEntityDetailSearch = (raw: Record<string, unknown>): EntityDetailSearchParams => ({
  contentFolder: typeof raw.contentFolder === 'string' ? raw.contentFolder : undefined,
});

export type MarkdownSearchParams = {
  mode?: 'edit' | 'preview';
  panel?: 'preview' | 'history';
  revisionId?: string;
  historyMode?: 'preview' | 'compare';
  compareMode?: 'to-current' | 'changes-in-version';
};

export const validateMarkdownSearch = (raw: Record<string, unknown>): MarkdownSearchParams => ({
  mode: raw.mode === 'edit' || raw.mode === 'preview' ? raw.mode : undefined,
  panel: raw.panel === 'preview' || raw.panel === 'history' ? raw.panel : undefined,
  revisionId: typeof raw.revisionId === 'string' ? raw.revisionId : undefined,
  historyMode: raw.historyMode === 'preview' || raw.historyMode === 'compare' ? raw.historyMode : undefined,
  compareMode: raw.compareMode === 'to-current' || raw.compareMode === 'changes-in-version' ? raw.compareMode : undefined,
});

// Project detail params
export type ProjectSearchParams = {
  tab?: 'projects' | 'archive';
  folder?: string;
  section?: 'home' | 'entities';
  dialog?: 'add-entity';
};

export const validateProjectSearch = (raw: Record<string, unknown>): ProjectSearchParams => ({
  tab: raw.tab === 'projects' || raw.tab === 'archive' ? raw.tab : undefined,
  folder: typeof raw.folder === 'string' ? raw.folder : undefined,
  section: raw.section === 'home' || raw.section === 'entities' ? raw.section : undefined,
  dialog: raw.dialog === 'add-entity' ? raw.dialog : undefined,
});

// Settings params
export type SettingsSearchParams = {
  section?: string;
};

export const validateSettingsSearch = (raw: Record<string, unknown>): SettingsSearchParams => ({
  section: typeof raw.section === 'string' ? raw.section : undefined,
});

// Search params
export type SearchRouteSearchParams = {
  q?: string;
};

export const validateSearchSearch = (raw: Record<string, unknown>): SearchRouteSearchParams => ({
  q: typeof raw.q === 'string' ? raw.q : undefined,
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

// Assistant params
export type AssistantSearchParams = {
  conversation?: string;
  layout?: 'conversation' | 'split';
};

export const validateAssistantSearch = (raw: Record<string, unknown>): AssistantSearchParams => ({
  conversation: typeof raw.conversation === 'string' ? raw.conversation : undefined,
  layout: raw.layout === 'conversation' || raw.layout === 'split' ? raw.layout : undefined,
});
