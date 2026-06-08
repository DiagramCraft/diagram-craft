
export type BrowserView = 'table' | 'cards' | 'tree' | 'radar' | 'timeline';

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

export type TimelineViewConfig = {
  startFieldId: string | null;
  endFieldId: string | null;
  groupBy: 'owner' | 'type';
  zoom: 'month' | 'quarter' | 'year';
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
    timeline?: TimelineViewConfig;
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
    timeline?: TimelineViewConfig;
  } | null;
};

export type UpdateSavedViewRequest = Partial<CreateSavedViewRequest>;
