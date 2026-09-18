import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { ApiSpecificationItem } from '@arch-register/api-types/artifactContract';
import { apiSpecificationQuery } from '../../queries/artifacts';
import { useApiSpecificationRevisions } from './useApiOperationsCounts';

export type ApiOperationsFeedRef = { id: string; publicId: string; name: string };

export type ApiOperationRow = {
  key: string;
  api: ApiOperationsFeedRef;
  item: ApiSpecificationItem;
};

/**
 * Flattens every operation/message across a set of API entities into one list — backs the APIs
 * section's cross-API "Operations" and "Deprecated operations" views (#3345). Builds on
 * `useApiSpecificationRevisions`' shared artifact/revision resolution
 * (`useApiOperationsCounts.ts`), adding a third `useQueries` stage that fetches each API's
 * normalized projection items. The `deprecated` filter is applied server-side via the existing
 * `ApiSpecificationFilters` support, so the Deprecated view needs no client-side filtering.
 *
 * Caps each API's fetched operations at 200 (the projection endpoint's own server-side cap) — like
 * `useApiOperationsCounts`'s per-entity fan-out, this is acceptable at catalog scale (#3150 is
 * explicitly not a high-throughput API gateway); an API with more than 200 operations shows a
 * truncated cross-API view here (its own drawer's Specification section still paginates fully).
 *
 * `enabled` gates all three query stages — callers should only enable this for the view that's
 * actually selected (the screen calls this once per sub-view, each with its own `enabled`), so
 * switching to the Catalog tab never fires this fan-out.
 */
export const useApiOperationsFeed = (
  workspaceId: string,
  apis: readonly ApiOperationsFeedRef[],
  filters: { deprecated?: boolean } = {},
  enabled = true
): { rows: ApiOperationRow[]; isLoading: boolean } => {
  const apiIds = useMemo(() => apis.map(api => api.id), [apis]);
  const { entries, isLoading: revisionsLoading } = useApiSpecificationRevisions(
    workspaceId,
    enabled ? apiIds : []
  );

  const projectionQueries = useQueries({
    queries: entries.map(entry =>
      apiSpecificationQuery(
        workspaceId,
        entry.entityId,
        entry.artifactId ?? '',
        entry.revisionId ?? '',
        { limit: 200, offset: 0, ...(filters.deprecated != null ? { deprecated: filters.deprecated } : {}) },
        enabled && entry.artifactId != null && entry.revisionId != null
      )
    )
  });

  const isLoading = enabled && (revisionsLoading || projectionQueries.some(query => query.isPending));

  const rows = useMemo(() => {
    if (!enabled) return [];
    const apiById = new Map(apis.map(api => [api.id, api]));
    const result: ApiOperationRow[] = [];
    entries.forEach((entry, index) => {
      const api = apiById.get(entry.entityId);
      if (!api) return;
      const items = projectionQueries[index]?.data?.items ?? [];
      for (const item of items) {
        result.push({ key: `${api.id}:${item.id}`, api, item });
      }
    });
    return result;
  }, [enabled, apis, entries, projectionQueries]);

  return { rows, isLoading };
};
