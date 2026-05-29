// Entity browser filters
export type EntitySearchParams = {
  type?: string;
  status?: string;
  owner?: string;
};

export const validateEntitySearch = (raw: Record<string, unknown>): EntitySearchParams => ({
  type: typeof raw.type === 'string' ? raw.type : undefined,
  status: typeof raw.status === 'string' ? raw.status : undefined,
  owner: typeof raw.owner === 'string' ? raw.owner : undefined,
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
  schema?: string;
};

export const validateModelSearch = (raw: Record<string, unknown>): ModelSearchParams => ({
  schema: typeof raw.schema === 'string' ? raw.schema : undefined,
});
