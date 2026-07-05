import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { BrowserSearch, BrowserViewConfigMap } from './entityBrowserState';
import {
  getFilterValue,
  parseConditionsFromSearch,
  parseViewConfigs,
  pruneAssessmentReferences,
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

  const conditions = useMemo(
    () =>
      parseConditionsFromSearch({
        filters: search.filters,
        owner: search.owner,
        status: search.status,
        type: search.type
      } as BrowserSearch),
    [search.filters, search.owner, search.status, search.type]
  );
  const projectScope = projectId ? (search.projectScope ?? 'project') : 'all';
  const q = search.q ?? '';
  const sort = search.sort ?? 'name';
  const view = search.viewMode ?? 'table';
  const viewConfigs = useMemo(() => parseViewConfigs(search.viewConfigs), [search.viewConfigs]);
  const activeViewConfig = viewConfigs[view] ?? null;

  const navigateBrowser = useCallback(
    (patch: Partial<BrowserSearch>, replace = false) => {
      const nextSearch = (previous: Record<string, unknown>) => ({
        ...previous,
        ...patch
      });

      if (projectId) {
        navigate({
          ...projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)),
          search: (previous: Record<string, unknown>) => ({
            ...nextSearch(previous),
            section: 'entities'
          }),
          replace
        });
        return;
      }

      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug },
        search: nextSearch,
        replace
      });
    },
    [navigate, projectId, workspaceSlug]
  );

  const setConditions = useCallback(
    (next: FilterCondition[]) =>
      navigateBrowser({
        filters: next.length > 0 ? JSON.stringify(next) : undefined,
        type: undefined,
        status: undefined,
        owner: undefined,
        viewId: undefined
      }),
    [navigateBrowser]
  );
  const setProjectScope = useCallback(
    (next: 'project' | 'all') =>
      navigateBrowser({ projectScope: next === 'project' ? undefined : next, viewId: undefined }),
    [navigateBrowser]
  );
  const setQ = useCallback(
    (next: string) => navigateBrowser({ q: next === '' ? undefined : next, viewId: undefined }, true),
    [navigateBrowser]
  );
  const setSort = useCallback(
    (next: string, replace = false) =>
      navigateBrowser({ sort: next === 'name' ? undefined : next, viewId: undefined }, replace),
    [navigateBrowser]
  );
  const setView = useCallback(
    (next: BrowserView) =>
      navigateBrowser({ viewMode: next === 'table' ? undefined : next, viewId: undefined }),
    [navigateBrowser]
  );
  const setViewConfigs = useCallback(
    (next: BrowserViewConfigMap) =>
      navigateBrowser({ viewConfigs: serializeViewConfigs(next), viewId: undefined }, true),
    [navigateBrowser]
  );
  const setActiveViewConfig = useCallback(
    (config: unknown) => {
      const next = { ...viewConfigs };
      if (config == null) delete next[view];
      else next[view] = config;
      setViewConfigs(next);
    },
    [setViewConfigs, view, viewConfigs]
  );

  const setAsOf = useCallback(
    (date: string) => navigateBrowser({ asOf: date }),
    [navigateBrowser]
  );
  const clearAsOf = useCallback(
    () => navigateBrowser({ asOf: undefined }),
    [navigateBrowser]
  );
  const setIncludeProjectSnapshots = useCallback(
    (include: boolean) =>
      navigateBrowser({ asOfIncludeProjects: include ? undefined : 'false' }),
    [navigateBrowser]
  );

  const setJoinAssessmentId = useCallback(
    (next: string | null) => {
      const { conditions: prunedConditions, viewConfigs: prunedViewConfigs } = pruneAssessmentReferences(
        conditions,
        viewConfigs
      );
      navigateBrowser({
        joinAssessmentId: next ?? undefined,
        filters: prunedConditions.length > 0 ? JSON.stringify(prunedConditions) : undefined,
        viewConfigs: serializeViewConfigs(prunedViewConfigs),
        viewId: undefined
      });
    },
    [conditions, navigateBrowser, viewConfigs]
  );

  return {
    activeViewConfig,
    asOf: search.asOf,
    includeProjectSnapshots: search.asOfIncludeProjects !== 'false',
    setAsOf,
    clearAsOf,
    setIncludeProjectSnapshots,
    conditions,
    joinAssessmentId: search.joinAssessmentId ?? null,
    ownerFilter: getFilterValue(conditions, '_owner'),
    projectScope,
    q,
    search,
    setConditions,
    setActiveViewConfig,
    setJoinAssessmentId,
    setProjectScope,
    setQ,
    setSort,
    setView,
    sort,
    statusFilter: getFilterValue(conditions, '_lifecycle'),
    typeFilter: getFilterValue(conditions, '_schemaId'),
    view,
    viewConfigs
  };
};
