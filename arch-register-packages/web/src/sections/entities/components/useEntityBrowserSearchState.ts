import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { BrowserView, ExploreViewConfig, FilterCondition } from '@arch-register/api-types/viewContract';
import {
  asProjectPublicId,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import type { BrowserSearch } from './entityBrowserState';
import {
  getFilterValue,
  parseConditionsFromSearch,
  parseJsonConfig,
  serializeConfig
} from './entityBrowserState';
import type { HierarchyConfig } from './HierarchyView';
import type { MatrixConfig } from './MatrixView';
import { parseExploreConfigValue } from './ExploreView.helpers';
import type { RadarConfig } from './RadarView';
import type { TimelineConfig } from './TimelineView';

type UseEntityBrowserSearchStateProps = {
  workspaceSlug: string;
  projectId?: string;
};

export const useEntityBrowserSearchState = ({
  workspaceSlug,
  projectId
}: UseEntityBrowserSearchStateProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as BrowserSearch;
  const [q, setQ] = useState(search.q ?? '');
  const [conditions, setConditions] = useState<FilterCondition[]>(() =>
    parseConditionsFromSearch(search)
  );
  const [projectScope, setProjectScope] = useState<'project' | 'all'>(
    projectId ? (search.projectScope ?? 'project') : 'all'
  );
  const [sort, setSort] = useState(search.sort ?? 'name');
  const [view, setView] = useState<BrowserView>(search.viewMode ?? 'table');
  const [radarConfig, setRadarConfig] = useState<RadarConfig | null>(() =>
    parseJsonConfig<RadarConfig>(search.radarConfig)
  );
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig | null>(() =>
    parseJsonConfig<TimelineConfig>(search.timelineConfig)
  );
  const [matrixConfig, setMatrixConfig] = useState<MatrixConfig | null>(() =>
    parseJsonConfig<MatrixConfig>(search.matrixConfig)
  );
  const [hierarchyConfig, setHierarchyConfig] = useState<HierarchyConfig | null>(() =>
    parseJsonConfig<HierarchyConfig>(search.hierarchyConfig)
  );
  const [exploreConfig, setExploreConfig] = useState<ExploreViewConfig | null>(() =>
    parseExploreConfigValue(search.exploreConfig)
  );

  const typeFilter = useMemo(() => getFilterValue(conditions, '_schemaId'), [conditions]);
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);

  useEffect(() => {
    setQ(search.q ?? '');
    setConditions(
      parseConditionsFromSearch({
        filters: search.filters,
        type: search.type,
        status: search.status,
        owner: search.owner
      } as BrowserSearch)
    );
    setProjectScope(projectId ? (search.projectScope ?? 'project') : 'all');
    setSort(search.sort ?? 'name');
    setView(search.viewMode ?? 'table');
    setRadarConfig(parseJsonConfig<RadarConfig>(search.radarConfig));
    setTimelineConfig(parseJsonConfig<TimelineConfig>(search.timelineConfig));
    setMatrixConfig(parseJsonConfig<MatrixConfig>(search.matrixConfig));
    setHierarchyConfig(parseJsonConfig<HierarchyConfig>(search.hierarchyConfig));
    setExploreConfig(parseExploreConfigValue(search.exploreConfig));
  }, [
    projectId,
    search.exploreConfig,
    search.filters,
    search.hierarchyConfig,
    search.matrixConfig,
    search.owner,
    search.projectScope,
    search.q,
    search.radarConfig,
    search.sort,
    search.status,
    search.timelineConfig,
    search.type,
    search.viewMode
  ]);

  const navigateBrowser = useCallback(
    (replace: boolean) => {
      const nextSearch = {
        q: q === '' ? undefined : q,
        type: undefined,
        status: undefined,
        owner: undefined,
        viewMode: view,
        sort,
        projectScope: projectId ? projectScope : undefined,
        radarConfig: serializeConfig(radarConfig),
        timelineConfig: serializeConfig(timelineConfig),
        matrixConfig: serializeConfig(matrixConfig),
        hierarchyConfig: serializeConfig(hierarchyConfig),
        exploreConfig: serializeConfig(exploreConfig),
        filters: conditions.length > 0 ? JSON.stringify(conditions) : undefined
      };

      if (projectId) {
        navigate({
          ...projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)),
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            ...nextSearch,
            section: 'entities'
          }),
          replace
        });
        return;
      }

      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug },
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...nextSearch
        }),
        replace
      });
    },
    [
      conditions,
      exploreConfig,
      hierarchyConfig,
      matrixConfig,
      navigate,
      projectId,
      projectScope,
      q,
      radarConfig,
      sort,
      timelineConfig,
      view,
      workspaceSlug
    ]
  );

  useEffect(() => {
    const nextFilters = conditions.length > 0 ? JSON.stringify(conditions) : undefined;
    if (
      (search.q ?? undefined) !== (q === '' ? undefined : q) ||
      search.viewMode !== view ||
      search.sort !== sort ||
      (projectId ? (search.projectScope ?? 'project') : undefined) !==
        (projectId ? projectScope : undefined) ||
      search.filters !== nextFilters ||
      search.radarConfig !== serializeConfig(radarConfig) ||
      search.timelineConfig !== serializeConfig(timelineConfig) ||
      search.matrixConfig !== serializeConfig(matrixConfig) ||
      search.hierarchyConfig !== serializeConfig(hierarchyConfig) ||
      search.exploreConfig !== serializeConfig(exploreConfig)
    ) {
      navigateBrowser(true);
    }
  }, [
    conditions,
    exploreConfig,
    hierarchyConfig,
    matrixConfig,
    navigateBrowser,
    projectId,
    projectScope,
    q,
    radarConfig,
    search.exploreConfig,
    search.filters,
    search.hierarchyConfig,
    search.matrixConfig,
    search.projectScope,
    search.q,
    search.radarConfig,
    search.sort,
    search.timelineConfig,
    search.viewMode,
    sort,
    timelineConfig,
    view
  ]);

  return {
    conditions,
    exploreConfig,
    hierarchyConfig,
    matrixConfig,
    ownerFilter,
    projectScope,
    q,
    radarConfig,
    search,
    setConditions,
    setExploreConfig,
    setHierarchyConfig,
    setMatrixConfig,
    setProjectScope,
    setQ,
    setRadarConfig,
    setSort,
    setTimelineConfig,
    setView,
    sort,
    statusFilter,
    timelineConfig,
    typeFilter,
    view
  };
};
