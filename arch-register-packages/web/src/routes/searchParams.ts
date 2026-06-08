// Entity browser filters
export type EntitySearchParams = {
  type?: string;
  status?: string;
  owner?: string;
  q?: string;
  viewId?: string;
  viewMode?: 'table' | 'cards' | 'tree' | 'radar' | 'timeline';
  radarConfig?: string;
  timelineConfig?: string;
  sidebarTab?: 'filters' | 'views';
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
    raw.viewMode === 'timeline'
      ? raw.viewMode
      : undefined,
  radarConfig: typeof raw.radarConfig === 'string' ? raw.radarConfig : undefined,
  timelineConfig: typeof raw.timelineConfig === 'string' ? raw.timelineConfig : undefined,
  sidebarTab: raw.sidebarTab === 'filters' || raw.sidebarTab === 'views' ? raw.sidebarTab : undefined,
  filters: typeof raw.filters === 'string' ? raw.filters : undefined,
});

// Project detail params
export type ProjectSearchParams = {
  tab?: 'projects' | 'archive';
  folder?: string;
};

export const validateProjectSearch = (raw: Record<string, unknown>): ProjectSearchParams => ({
  tab: raw.tab === 'projects' || raw.tab === 'archive' ? raw.tab : undefined,
  folder: typeof raw.folder === 'string' ? raw.folder : undefined,
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

// Assistant params
export type AssistantSearchParams = {
  conversation?: string;
  layout?: 'conversation' | 'split';
};

export const validateAssistantSearch = (raw: Record<string, unknown>): AssistantSearchParams => ({
  conversation: typeof raw.conversation === 'string' ? raw.conversation : undefined,
  layout: raw.layout === 'conversation' || raw.layout === 'split' ? raw.layout : undefined,
});
