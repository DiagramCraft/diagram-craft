import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { apiSpecificationRevisionListQuery, entityArtifactsQuery } from '../../queries/artifacts';
import { selectApiSpecificationArtifacts } from '../../hooks/useArtifacts';

/**
 * Resolves each API entity's normalized operations/messages count — its primary
 * `api-specification` artifact's current revision `itemCount` (#3316's "operations count"
 * column). There's no rollup engine for artifact projections (those only aggregate over typed
 * relations/containment), so this fans out per-entity with `useQueries`, mirroring
 * `../vendor-management/useVendorSpendRollups.ts`'s per-id batching shape. Acceptable at catalog
 * scale — #3150 is explicitly not a high-throughput API gateway.
 */
export const useApiOperationsCounts = (workspaceId: string, apiEntityIds: readonly string[]) => {
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

  const isLoading =
    artifactsQueries.some(query => query.isPending) ||
    revisionQueries.some(query => query.isPending);

  const byId = useMemo(() => {
    const map = new Map<string, number | null>();
    primaryArtifacts.forEach(({ entityId, artifactId }, index) => {
      if (artifactId == null) {
        map.set(entityId, null);
        return;
      }
      const revisions = revisionQueries[index]?.data ?? [];
      const current = revisions.find(revision => revision.isCurrent) ?? revisions[0];
      map.set(entityId, current?.itemCount ?? null);
    });
    return map;
  }, [primaryArtifacts, revisionQueries]);

  return { byId, isLoading };
};
