import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { BrowserSearch, BrowserViewConfigMap } from './entityBrowserState';
import {
  getFilterValue,
  parseConditionsFromSearch,
  parseEntityQueryFromSearch,
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
  const search = useSearch({ strict: false });

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
  const entityQuery = useMemo(
    () =>
      parseEntityQueryFromSearch({
        entityQuery: search.entityQuery
      } as BrowserSearch),
    [search.entityQuery]
  );
  const projectScope = projectId ? (search.projectScope ?? 'project') : 'all';
  const q = search.q ?? '';
  const sort = search.sort ?? 'name';
  const collectionId = search.collectionId ?? null;
  const requestedView = search.viewMode ?? 'table';
  const view =
    collectionId && requestedView !== 'table' && requestedView !== 'cards'
      ? 'table'
      : requestedView;
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
            section: 'entities' as const
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
        entityQuery: undefined,
        type: undefined,
        status: undefined,
        owner: undefined,
        viewId: undefined
      }),
    [navigateBrowser]
  );
  // Advanced-mode text field writes the canonical EntityQuery directly, superseding the
  // Basic-mode `filters`/`q`/`type`/`status`/`owner` params it was derived from (or replaces).
  const setEntityQuery = useCallback(
    (next: EntityQuery | null) =>
      navigateBrowser({
        entityQuery: next ? JSON.stringify(next) : undefined,
        filters: undefined,
        q: undefined,
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
    (next: string) =>
      navigateBrowser({ q: next === '' ? undefined : next, viewId: undefined }, true),
    [navigateBrowser]
  );
  const setSort = useCallback(
    (next: string, replace = false) =>
      navigateBrowser({ sort: next === 'name' ? undefined : next, viewId: undefined }, replace),
    [navigateBrowser]
  );
  const setView = useCallback(
    (next: BrowserView) => {
      if (collectionId && next !== 'table' && next !== 'cards') return;
      navigateBrowser({ viewMode: next === 'table' ? undefined : next, viewId: undefined });
    },
    [collectionId, navigateBrowser]
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

  const setAsOf = useCallback((date: string) => navigateBrowser({ asOf: date }), [navigateBrowser]);
  const clearAsOf = useCallback(() => navigateBrowser({ asOf: undefined }), [navigateBrowser]);
  const setIncludePlannedChanges = useCallback(
    (include: boolean) => navigateBrowser({ asOfIncludeProjects: include ? undefined : 'false' }),
    [navigateBrowser]
  );

  const setJoinAssessmentId = useCallback(
    (next: string | null) => {
      const { conditions: prunedConditions, viewConfigs: prunedViewConfigs } =
        pruneAssessmentReferences(conditions, viewConfigs);
      navigateBrowser({
        joinAssessmentId: next ?? undefined,
        filters: prunedConditions.length > 0 ? JSON.stringify(prunedConditions) : undefined,
        entityQuery: undefined,
        viewConfigs: serializeViewConfigs(prunedViewConfigs),
        viewId: undefined
      });
    },
    [conditions, navigateBrowser, viewConfigs]
  );

  return {
    activeViewConfig,
    asOf: search.asOf,
    includePlannedChanges: search.asOfIncludeProjects !== 'false',
    setAsOf,
    clearAsOf,
    setIncludePlannedChanges,
    conditions,
    entityQuery,
    joinAssessmentId: search.joinAssessmentId ?? null,
    collectionId,
    ownerFilter: getFilterValue(conditions, '_owner'),
    projectScope,
    q,
    search,
    setConditions,
    setActiveViewConfig,
    setEntityQuery,
    setJoinAssessmentId,
    setProjectScope,
    setQ,
    setSort,
    setView,
    sort,
    statusFilter: getFilterValue(conditions, '_lifecycle'),
    typeFilter: entityQuery?.schemaId ?? getFilterValue(conditions, '_schemaId'),
    view,
    viewConfigs
  };
};
