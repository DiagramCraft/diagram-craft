import { useQuery } from '@tanstack/react-query';
import { metricRollupQuery } from '../../../../queries/metrics';
import { buildRollupMetric } from './useEntityRollupMetric';

export type EntityRollupLeafCount = {
  leafCount: number | null;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: EntityRollupLeafCount = { leafCount: null, isLoading: false, error: null };

/**
 * Count of descendant entities with no containment children of their own, over an entity's
 * recursive `parent`-containment subtree — backs the drawer's standalone `rollup-leaf-count` item.
 *
 * `leafCount` aggregation ignores `source`; `placeholderFieldId` only needs to be some field that
 * exists on the schema (any schema with a `parent` containment field has at least one other
 * field), to satisfy the metric contract's required `source`.
 */
export const useEntityRollupLeafCount = (
  workspaceId: string,
  schemaId: string | null,
  entityId: string | null,
  placeholderFieldId: string
): EntityRollupLeafCount => {
  const boxEntityIds = entityId ? [entityId] : [];
  const enabled = boxEntityIds.length > 0 && !!schemaId;
  const query = useQuery(
    metricRollupQuery(
      workspaceId,
      { boxEntityIds, metric: buildRollupMetric(schemaId, placeholderFieldId, 'leafCount') },
      enabled
    )
  );

  const id0 = boxEntityIds[0];
  if (!id0) return { ...EMPTY, isLoading: query.isLoading, error: (query.error as Error) ?? null };

  const result = query.data?.results.find(candidate => candidate.boxEntityId === id0);
  const isLeaf = (result?.sourceCount ?? 0) === 0;

  return {
    leafCount: isLeaf ? 1 : (result?.value ?? null),
    isLoading: query.isLoading,
    error: (query.error as Error) ?? null
  };
};
