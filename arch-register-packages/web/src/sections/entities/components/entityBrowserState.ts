import type {
  BrowserView,
  CreateSavedViewRequest,
  FilterCondition,
  SavedView
} from '@arch-register/api-types/viewContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ProjectDetail, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySearchParams, ProjectSearchParams } from '../../../routes/searchParams';

export type BrowserSearch = EntitySearchParams &
  ProjectSearchParams & {
    sidebarTab?: 'filters' | 'views' | 'pinned';
  };

export type ProjectLinkState = {
  linked: boolean;
  entityType: { id: string; name: string } | null;
  isDone: boolean;
};

export type BrowserEntityRecord = EntityRecord & {
  _projectLink?: ProjectLinkState;
};

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

export const formatDateValue = (value: unknown) => {
  const parsed = parseDateValue(value);
  if (parsed == null) return '—';
  const date = new Date(`${parsed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? parsed : date.toLocaleDateString();
};

export const parseConditionsFromSearch = (search: BrowserSearch): FilterCondition[] => {
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

export const parseJsonConfig = <T,>(value: string | undefined): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const serializeConfig = <T,>(value: T | null) => (value ? JSON.stringify(value) : undefined);

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

const getSavedViewConfig = (view: SavedView): unknown | null => {
  if (view.config == null) return null;
  if (view.viewMode === 'radar') return view.config.radar ?? null;
  if (view.viewMode === 'timeline') return view.config.timeline ?? null;
  if (view.viewMode === 'matrix') return view.config.matrix ?? null;
  if (view.viewMode === 'hierarchy') return view.config.hierarchy ?? null;
  if (view.viewMode === 'explore') return view.config.explore ?? null;
  return null;
};

export const toSavedViewSearch = (view: SavedView): Partial<BrowserSearch> => ({
  type: view.filters.schemaId ?? undefined,
  status: view.filters.status ?? undefined,
  owner: view.filters.owner ?? undefined,
  q: view.filters.q ?? undefined,
  viewId: view.id,
  viewMode: view.viewMode,
  sort: view.filters.sort ?? undefined,
  projectScope: view.projectScope ?? undefined,
  viewConfigs: serializeViewConfigs(
    getSavedViewConfig(view) == null ? {} : { [view.viewMode]: getSavedViewConfig(view) }
  ),
  filters: view.filters.conditions ? JSON.stringify(view.filters.conditions) : undefined
});

export const getFilterValue = (conditions: FilterCondition[], fieldId: string) =>
  (conditions.find(c => c.fieldId === fieldId && c.op === 'equals')?.value as string) ?? null;

export const toSavedViewConfig = (
  view: BrowserView,
  viewConfigs: BrowserViewConfigMap
): CreateSavedViewRequest['config'] => {
  const config = viewConfigs[view];
  if (config == null) return null;
  if (view === 'radar') return { radar: config as never };
  if (view === 'timeline') return { timeline: config as never };
  if (view === 'matrix') return { matrix: config as never };
  if (view === 'hierarchy') return { hierarchy: config as never };
  if (view === 'explore') return { explore: config as never };
  return null;
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
  statusFilter,
  ownerFilter,
  q,
  sort,
  conditions,
  viewConfigs
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
}): CreateSavedViewRequest => ({
  scope,
  projectId: scope === 'project' ? (projectId ?? null) : null,
  projectScope: scope === 'project' ? (projectScope ?? null) : null,
  name,
  description: description || null,
  isAdminView: isAdminView ?? false,
  viewMode: view,
  filters: {
    schemaId: typeFilter,
    status: statusFilter,
    owner: ownerFilter,
    q,
    sort,
    conditions
  },
  config: toSavedViewConfig(view, viewConfigs)
});
