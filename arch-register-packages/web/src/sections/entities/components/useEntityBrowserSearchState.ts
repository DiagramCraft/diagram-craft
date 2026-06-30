import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import {
  asProjectPublicId,
  projectDetailRoute
} from '../../../routes/publicObjectRoutes';
import type { BrowserSearch, BrowserViewConfigMap } from './entityBrowserState';
import {
  getFilterValue,
  parseConditionsFromSearch,
  parseViewConfigs,
  serializeViewConfigs
} from './entityBrowserState';

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
  const [viewConfigs, setViewConfigs] = useState<BrowserViewConfigMap>(() =>
    parseViewConfigs(search.viewConfigs)
  );

  const typeFilter = useMemo(() => getFilterValue(conditions, '_schemaId'), [conditions]);
  const statusFilter = useMemo(() => getFilterValue(conditions, '_lifecycle'), [conditions]);
  const ownerFilter = useMemo(() => getFilterValue(conditions, '_owner'), [conditions]);
  const activeViewConfig = useMemo(() => viewConfigs[view] ?? null, [view, viewConfigs]);

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
    setViewConfigs(parseViewConfigs(search.viewConfigs));
  }, [
    projectId,
    search.filters,
    search.owner,
    search.projectScope,
    search.q,
    search.sort,
    search.status,
    search.type,
    search.viewConfigs,
    search.viewMode
  ]);

  const setActiveViewConfig = useCallback(
    (config: unknown) => {
      setViewConfigs(prev => {
        const next = { ...prev };
        if (config == null) delete next[view];
        else next[view] = config;
        return next;
      });
    },
    [view]
  );

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
        viewConfigs: serializeViewConfigs(viewConfigs),
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
    [conditions, navigate, projectId, projectScope, q, sort, view, viewConfigs, workspaceSlug]
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
      search.viewConfigs !== serializeViewConfigs(viewConfigs)
    ) {
      navigateBrowser(true);
    }
  }, [
    conditions,
    navigateBrowser,
    projectId,
    projectScope,
    q,
    search.filters,
    search.projectScope,
    search.q,
    search.sort,
    search.viewConfigs,
    search.viewMode,
    sort,
    view,
    viewConfigs
  ]);

  return {
    activeViewConfig,
    conditions,
    ownerFilter,
    projectScope,
    q,
    search,
    setConditions,
    setActiveViewConfig,
    setProjectScope,
    setQ,
    setSort,
    setView,
    sort,
    statusFilter,
    typeFilter,
    view,
    viewConfigs
  };
};
