
export type BrowserView = 'table' | 'cards' | 'tree' | 'radar';

export type EntityFilters = {
  schemaId?: string | null;
  status?: string | null;
  owner?: string | null;
  q?: string;
  dateFilterField?: string;
  dateFilterOperator?: 'on' | 'before' | 'after' | 'empty';
  dateFilterValue?: string;
  sort?: string;
};

export type RadarViewConfig = {
  schemaId: string;
  quadrantFieldId: string;
  ringFieldId: string;
  ringOrder: string[];
};

export type SavedView = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  viewMode: BrowserView;
  filters: EntityFilters;
  config: {
    radar?: RadarViewConfig;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSavedViewRequest = {
  name: string;
  description?: string | null;
  viewMode: BrowserView;
  filters: EntityFilters;
  config?: {
    radar?: RadarViewConfig;
  } | null;
};

export type UpdateSavedViewRequest = Partial<CreateSavedViewRequest>;
