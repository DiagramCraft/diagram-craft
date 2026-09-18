import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiSpecificationRevisionListQuery, entityArtifactsQuery } from '../../queries/artifacts';
import { selectApiSpecificationArtifacts } from '../../hooks/useArtifacts';

export type ApiSpecificationRevisionEntry = {
  entityId: string;
  artifactId?: string;
  revisionId?: string;
  itemCount: number | null;
};

/**
 * Resolves each API entity's primary `api-specification` artifact and current revision — the
 * shared two-stage `useQueries` fan-out (artifacts, then that artifact's revision list) used by
 * both `useApiOperationsCounts` (below) and `useApiOperationsFeed.ts`'s cross-API operations views
 * (#3345). Extracted so both hooks resolve "which revision is this API's operations coming from"
 * identically, rather than risking drift between two independent copies of this edge-case-heavy
 * logic (unlike the trivial `PROVIDERS_FIELD`/`CONSUMERS_FIELD` constant duplicated elsewhere in
 * this app, this fan-out has real edge cases — no artifact, no accepted revision — worth resolving
 * once). There's no rollup engine for artifact projections (those only aggregate over typed
 * relations/containment), so this fans out per-entity with `useQueries`, mirroring
 * `../vendor-management/useVendorSpendRollups.ts`'s per-id batching shape. Acceptable at catalog
 * scale — #3150 is explicitly not a high-throughput API gateway.
 */
export const useApiSpecificationRevisions = (
  workspaceId: string,
  apiEntityIds: readonly string[]
): { entries: ApiSpecificationRevisionEntry[]; isLoading: boolean } => {
  const artifactsQueries = useQueries({
    queries: apiEntityIds.map(entityId => entityArtifactsQuery(workspaceId, entityId))
  });

  const primaryArtifacts = useMemo(
    () =>
      apiEntityIds.map((entityId, index) => {
        const [primary] = selectApiSpecificationArtifacts(
          artifactsQueries[index]?.data?.artifacts ?? []
        );
        return { entityId, artifactId: primary?.id };
      }),
    [apiEntityIds, artifactsQueries]
  );

  const revisionQueries = useQueries({
    queries: primaryArtifacts.map(({ entityId, artifactId }) =>
      apiSpecificationRevisionListQuery(workspaceId, entityId, artifactId ?? '', artifactId != null)
    )
  });

  // `revisionQueries` stays permanently disabled — and so permanently `isPending` — for any entity
  // with no `api-specification` artifact at all (`artifactId == null`); only count queries actually
  // expected to fetch, or a workspace with even one such API would report `isLoading` forever.
  const isLoading =
    artifactsQueries.some(query => query.isPending) ||
    revisionQueries.some(
      (query, index) => primaryArtifacts[index]?.artifactId != null && query.isPending
    );

  const entries = useMemo(
    () =>
      primaryArtifacts.map(({ entityId, artifactId }, index) => {
        if (artifactId == null) return { entityId, itemCount: null };
        const revisions = revisionQueries[index]?.data ?? [];
        const current = revisions.find(revision => revision.isCurrent) ?? revisions[0];
        return {
          entityId,
          artifactId,
          revisionId: current?.revision.id,
          itemCount: current?.itemCount ?? null
        };
      }),
    [primaryArtifacts, revisionQueries]
  );

  return { entries, isLoading };
};

/**
 * Resolves each API entity's normalized operations/messages count — its primary
 * `api-specification` artifact's current revision `itemCount` (#3316's "operations count"
 * column). See `useApiSpecificationRevisions` above for the shared resolution this builds on.
 */
export const useApiOperationsCounts = (workspaceId: string, apiEntityIds: readonly string[]) => {
  const { entries, isLoading } = useApiSpecificationRevisions(workspaceId, apiEntityIds);

  const byId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const entry of entries) map.set(entry.entityId, entry.itemCount);
    return map;
  }, [entries]);

  return { byId, isLoading };
};
