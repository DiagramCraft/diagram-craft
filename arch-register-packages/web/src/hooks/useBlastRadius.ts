import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityTraversalSubject } from '@arch-register/api-types/entityTraversalContract';
import { entityBlastRadiusAggregateQuery } from '../queries/entityTraversal';
import {
  filterBlastRadiusEntities,
  uniqueProvenanceHopIds,
  type BlastRadiusEntityFilters
} from '../lib/blastRadiusFilters';
import { useEntitiesByIds } from './useEntities';

export const DEFAULT_BLAST_RADIUS_DEPTH = 1;

export type BlastRadiusFilters = BlastRadiusEntityFilters & { maxDepth: number };

export type BlastRadiusStatus = 'loading' | 'error' | 'empty' | 'ready';

const BLAST_RADIUS_PATHS = [
  { id: 'blast-radius', steps: [{ kind: 'relationSubtree' as const, direction: 'both' as const }] }
];

export const useBlastRadius = (
  workspaceId: string,
  subject: EntityTraversalSubject | null,
  filters: BlastRadiusFilters,
  enabled = true
) => {
  const query = useQuery(
    entityBlastRadiusAggregateQuery(
      workspaceId,
      subject ?? { kind: 'entity', entityId: '' },
      BLAST_RADIUS_PATHS,
      filters.maxDepth,
      enabled && !!subject
    )
  );

  const entities = query.data?.entities ?? [];

  const filtered = useMemo(() => filterBlastRadiusEntities(entities, filters), [entities, filters]);

  const hopIds = useMemo(() => uniqueProvenanceHopIds(filtered), [filtered]);
  const hopLookup = useEntitiesByIds(workspaceId, hopIds);

  const status: BlastRadiusStatus = query.isLoading
    ? 'loading'
    : query.isError
      ? 'error'
      : filtered.length === 0
        ? 'empty'
        : 'ready';

  return {
    status,
    entities: filtered,
    totalCount: entities.length,
    groups: query.data?.groups,
    hopLookup,
    error: query.error
  };
};
