import type {
  BrowserView,
  CreateSavedViewRequest,
  ExploreViewConfig,
  FilterCondition,
  SavedView
} from '@arch-register/api-types/viewContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ProjectDetail, ProjectEntity } from '@arch-register/api-types/projectContract';
import type { EntitySearchParams, ProjectSearchParams } from '../../../routes/searchParams';
import type { RadarConfig } from './RadarView';
import type { TimelineConfig } from './TimelineView';
import type { MatrixConfig } from './MatrixView';
import type { HierarchyConfig } from './HierarchyView';
import { DEFAULT_EXPLORE_CONFIG } from './ExploreView.helpers';

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

export const toSavedViewSearch = (view: SavedView): Partial<BrowserSearch> => ({
  type: view.filters.schemaId ?? undefined,
  status: view.filters.status ?? undefined,
  owner: view.filters.owner ?? undefined,
  q: view.filters.q ?? undefined,
  viewId: view.id,
  viewMode: view.viewMode,
  sort: view.filters.sort ?? undefined,
  projectScope: view.projectScope ?? undefined,
  radarConfig: view.config?.radar ? JSON.stringify(view.config.radar) : undefined,
  timelineConfig: view.config?.timeline ? JSON.stringify(view.config.timeline) : undefined,
  matrixConfig: view.config?.matrix ? JSON.stringify(view.config.matrix) : undefined,
  hierarchyConfig: view.config?.hierarchy ? JSON.stringify(view.config.hierarchy) : undefined,
  exploreConfig: view.config?.explore ? JSON.stringify(view.config.explore) : undefined,
  filters: view.filters.conditions ? JSON.stringify(view.filters.conditions) : undefined
});

export const getFilterValue = (conditions: FilterCondition[], fieldId: string) =>
  (conditions.find(c => c.fieldId === fieldId && c.op === 'equals')?.value as string) ?? null;

export const toSavedViewConfig = (
  view: BrowserView,
  radarConfig: RadarConfig | null,
  timelineConfig: TimelineConfig | null,
  matrixConfig: MatrixConfig | null,
  hierarchyConfig: HierarchyConfig | null,
  exploreConfig: ExploreViewConfig | null
) => {
  if (view === 'radar' && radarConfig) return { radar: radarConfig };
  if (view === 'timeline' && timelineConfig) return { timeline: timelineConfig };
  if (view === 'matrix' && matrixConfig) return { matrix: matrixConfig };
  if (view === 'hierarchy' && hierarchyConfig) return { hierarchy: hierarchyConfig };
  if (view === 'explore') return { explore: exploreConfig ?? DEFAULT_EXPLORE_CONFIG };
  return null;
};

export const buildSavedViewPayload = ({
  scope,
  projectId,
  projectScope,
  name,
  description,
  view,
  typeFilter,
  statusFilter,
  ownerFilter,
  q,
  sort,
  conditions,
  radarConfig,
  timelineConfig,
  matrixConfig,
  hierarchyConfig,
  exploreConfig
}: {
  scope: 'workspace' | 'project';
  projectId?: string;
  projectScope?: 'project' | 'all';
  name: string;
  description: string;
  view: BrowserView;
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  q: string;
  sort: string;
  conditions: FilterCondition[];
  radarConfig: RadarConfig | null;
  timelineConfig: TimelineConfig | null;
  matrixConfig: MatrixConfig | null;
  hierarchyConfig: HierarchyConfig | null;
  exploreConfig: ExploreViewConfig | null;
}): CreateSavedViewRequest => ({
  scope,
  projectId: scope === 'project' ? (projectId ?? null) : null,
  projectScope: scope === 'project' ? (projectScope ?? null) : null,
  name,
  description: description || null,
  viewMode: view,
  filters: {
    schemaId: typeFilter,
    status: statusFilter,
    owner: ownerFilter,
    q,
    sort,
    conditions
  },
  config: toSavedViewConfig(
    view,
    radarConfig,
    timelineConfig,
    matrixConfig,
    hierarchyConfig,
    exploreConfig
  )
});
