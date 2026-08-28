import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import { useRelationsQuery } from '../../hooks/useRelations';
import { useSchemas } from '../../hooks/useSchemas';
import { useEnums } from '../../hooks/useEnums';
import { useRelationBrowserPagination } from './useRelationBrowserPagination';
import {
  buildRelationQueryFromFilters,
  filterConditionsFromRelationQuery,
  isRelationBasicRepresentable,
  parseRelationQueryFromSearch,
  resolveSingleSchemaFilter
} from './relationBrowserState';
import type { RelationBrowserView } from './relationBrowserState';

// Drives the relation-rooted browser (#2689/#2698/#2699): a flat filter-condition list (relation's own
// fields, "in"/"out" endpoint entity fields, and a "Type" field for the relation's own schema — see
// relationBrowserState.ts) and the resulting relation list, built on the schema-less `/relations/query`
// endpoint. Table and flat Graph views are supported — see RelationBrowser.tsx. There's no separate
// schema picker:
// "type" is just another filter condition, so the browser can show relations across every schema at
// once. Table columns and own/endpoint-field filtering both need one concrete schema to know which
// fields exist, though, so both fall back to a generic view unless the filters narrow to exactly one
// schema (`activeSchema`, via resolveSingleSchemaFilter).
//
// Conditions live in the URL's `entityQuery` search param (not local state) so saved views (#2699)
// are shareable and the sidebar's "active view" highlight survives a refresh — mirroring how
// EntityBrowserScreen.tsx derives `conditions` from `search` via parseConditionsFromSearch.
export const useRelationBrowserData = (workspaceId: string, view: RelationBrowserView) => {
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const { data: entitySchemas = [] } = useSchemas(workspaceId);
  const { data: enums = [] } = useEnums(workspaceId);
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  // The query as actually stored (URL search param / saved view) — the full structured query,
  // unmodified. `conditions` is a best-effort flattening of it for Basic mode's condition-row UI;
  // `representable` says whether that flattening is lossless. Only when it's NOT (an `or` root, a
  // `relationForward` step, or a projection — see isRelationBasicRepresentable) do we send
  // `parsedQuery` to the API as-is instead of rebuilding it from `conditions`, so a saved view
  // built around those constructs (e.g. #3066's governance views) executes correctly rather than
  // silently losing the parts Basic mode can't represent.
  const parsedQuery = useMemo(() => parseRelationQueryFromSearch(search), [search]);
  const conditions = useMemo(
    () => (parsedQuery ? filterConditionsFromRelationQuery(parsedQuery) : []),
    [parsedQuery]
  );
  const representable = parsedQuery == null || isRelationBasicRepresentable(parsedQuery);

  const setConditions = (next: FilterCondition[]) => {
    navigate({
      to: '/$workspaceSlug/entities/relations',
      params: { workspaceSlug: workspaceId },
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        entityQuery:
          next.length > 0 ? JSON.stringify(buildRelationQueryFromFilters(next)) : undefined,
        viewId: undefined
      })
    });
  };

  // Advanced mode writes a full EntityQuery (possibly non-representable) directly, bypassing the
  // conditions round-trip entirely.
  const setRelationQuery = (next: EntityQuery | null) => {
    navigate({
      to: '/$workspaceSlug/entities/relations',
      params: { workspaceSlug: workspaceId },
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        entityQuery: next ? JSON.stringify(next) : undefined,
        viewId: undefined
      })
    });
  };

  const relationQuery = useMemo(
    () => (parsedQuery && !representable ? parsedQuery : buildRelationQueryFromFilters(conditions)),
    [parsedQuery, representable, conditions]
  );

  const { goToNextPage, goToPreviousPage, handlePageSizeChange, pageIndex, pageSize } =
    useRelationBrowserPagination(conditions);

  const tableQuery = useRelationsQuery(
    workspaceId,
    relationQuery,
    {
      view: 'full',
      limit: pageSize,
      offset: pageIndex * pageSize
    },
    { enabled: view === 'table' }
  );
  const graphQuery = useRelationsQuery(
    workspaceId,
    relationQuery,
    { view: 'full' },
    {
      enabled: view === 'graph'
    }
  );

  const activeQuery = view === 'graph' ? graphQuery : tableQuery;

  const { data: relations, total, isLoading } = activeQuery;

  const activeSchemaId = resolveSingleSchemaFilter(conditions);
  const activeSchema = relationSchemas.find(schema => schema.id === activeSchemaId) ?? null;

  return {
    relationSchemas,
    entitySchemas,
    enums,
    conditions,
    setConditions,
    relationQuery,
    setRelationQuery,
    representable,
    activeSchema,
    relations,
    total: total ?? 0,
    isLoading,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    pageIndex,
    pageSize
  };
};
