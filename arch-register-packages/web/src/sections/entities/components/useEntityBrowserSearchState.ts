import { useCallback, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { BrowserSearch } from './entityBrowserState';
import { parseConditionsFromSearch, parseViewConfigs, serializeViewConfigs } from './entityBrowserState';
import { useEntityBrowserLocalState } from './useEntityBrowserLocalState';

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

  const {
    activeViewConfig,
    conditions,
    ownerFilter,
    projectScope,
    q,
    setConditions,
    setActiveViewConfig,
    setProjectScope,
    setQ,
    setSort,
    setView,
    setViewConfigs,
    sort,
    statusFilter,
    typeFilter,
    view,
    viewConfigs
  } = useEntityBrowserLocalState({
    projectId,
    initial: {
      q: search.q ?? '',
      conditions: parseConditionsFromSearch(search),
      projectScope: projectId ? (search.projectScope ?? 'project') : 'all',
      sort: search.sort ?? 'name',
      view: search.viewMode ?? 'table',
      viewConfigs: parseViewConfigs(search.viewConfigs)
    }
  });

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
    search.viewMode,
    setConditions,
    setProjectScope,
    setQ,
    setSort,
    setView,
    setViewConfigs
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
    asOf: search.asOf,
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
