import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityTraversalSubject } from '@arch-register/api-types/entityTraversalContract';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
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

export type BlastRadiusPath = { id: string; steps: readonly PathStep[] };

const WILDCARD_BLAST_RADIUS_PATHS: readonly BlastRadiusPath[] = [
  { id: 'blast-radius', steps: [{ kind: 'relationSubtree', direction: 'both' }] }
];

/**
 * `paths` defaults to the wildcard relation-subtree walk (every relation/reference field in
 * either direction). Callers that want to scope the traversal to specific relation types — e.g.
 * the API & Integration Catalog Impact section scoping to `Provides API`/`Consumes API` (#3320) —
 * pass their own `unboundTypedRelation`/`typedRelation` paths instead; the aggregate query and
 * engine already support arbitrary paths, this is just exposing that through the hook.
 */
export const useBlastRadius = (
  workspaceId: string,
  subject: EntityTraversalSubject | null,
  filters: BlastRadiusFilters,
  enabled = true,
  paths: readonly BlastRadiusPath[] = WILDCARD_BLAST_RADIUS_PATHS
) => {
  const query = useQuery(
    entityBlastRadiusAggregateQuery(
      workspaceId,
      subject ?? { kind: 'entity', entityId: '' },
      paths,
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
