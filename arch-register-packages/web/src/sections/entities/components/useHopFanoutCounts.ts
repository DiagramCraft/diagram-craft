import { useMemo } from 'react';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { useEntities } from '../../../hooks/useEntities';
import {
  PATH_WALKER_PROJECTION_ALIAS,
  buildHopColumnQuery,
  decodeHopColumnNodes
} from './pathWalkerViewState';

/**
 * For a column of source entities and a chosen outgoing `hop`, resolves how many distinct
 * entities each source would lead to in the next column - a single batched `includePath` query
 * over all source ids (the same cost model as the Traceability matrix). Returns an empty map when
 * no hop is chosen, so the caller can render counts only once the next relation is picked.
 */
export const useHopFanoutCounts = (
  workspaceId: string,
  fromEntityIds: string[],
  hop: PathStep | undefined
): Map<string, number> => {
  const enabled = !!hop && fromEntityIds.length > 0;
  const entityQuery = useMemo(
    () => (hop && fromEntityIds.length > 0 ? buildHopColumnQuery(fromEntityIds, hop) : undefined),
    [hop, fromEntityIds]
  );

  const { data } = useEntities(
    workspaceId,
    { view: 'summary', entityQuery, limit: fromEntityIds.length },
    { enabled }
  );

  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data) {
      counts.set(
        row._uid,
        decodeHopColumnNodes(row._projections?.[PATH_WALKER_PROJECTION_ALIAS]).length
      );
    }
    return counts;
  }, [data]);
};
