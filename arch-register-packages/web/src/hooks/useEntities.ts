import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type {
  EntityLandscapeDiffState,
  EntityRelation
} from '@arch-register/api-types/entityContract';
import type { EntityListOptions } from './entityListQuery';
import {
  entitiesBySchemaQuery,
  entityBatchRelationsQuery,
  entityCountQuery,
  entityCountsBySchemaQuery,
  entityDependentsQuery,
  entityDetailQuery,
  entityFacetsQuery,
  entityJsonQuery,
  entityLandscapeDiffQuery,
  entityRelationsQuery,
  entityTimelineMarkersQuery,
  entityTreeQuery,
  entitiesQuery,
  invalidateEntityDetails,
  invalidateEntityQueries,
  invalidateEntityDeletion
} from '../queries/entities';
import { invalidateEntityVersionQueries } from '../queries/entityVersions';
import { orpcClient } from '../lib/orpcClient';

export const useEntities = (
  workspaceId: string,
  options: EntityListOptions = {},
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery(entitiesQuery(workspaceId, options, queryOptions?.enabled ?? true));

  return {
    ...query,
    data: query.data?.items ?? [],
    total: query.data?.total
  };
};

// Hook for fetching a single entity
export const useEntity = (workspaceId: string, entityId: string) => {
  return useQuery(entityDetailQuery(workspaceId, entityId));
};

export const useEntityJson = (workspaceId: string, entityId: string, enabled = true) =>
  useQuery(entityJsonQuery(workspaceId, entityId, enabled));

// Hook for fetching an entity-landscape diff between two reconstructed states — powers both the
// project page's "What's changed" tab (from = now, to = project's end state) and the workspace
// entities section's "Diff" view (from = now, to = a chosen future date, both scoped to the
// currently active entity-browser filters).
export const useEntityLandscapeDiff = (
  workspaceId: string,
  from: EntityLandscapeDiffState | null,
  to: EntityLandscapeDiffState | null,
  enabled = true
) => useQuery(entityLandscapeDiffQuery(workspaceId, from, to, enabled));

// Builds the `from`/`to` states for a project's "what's changed by end of project" diff: now
// (no planned changes) vs. the project's connected entities with its planned changes applied.
export const buildProjectLandscapeDiffStates = (
  projectId: string,
  targetDate: string,
  includeOverdueChanges = false
): { from: EntityLandscapeDiffState; to: EntityLandscapeDiffState } => ({
  from: {
    asOf: new Date().toISOString(),
    includePlannedChanges: false,
    includeOverdueChanges: false
  },
  to: { asOf: targetDate, projectId, includePlannedChanges: true, includeOverdueChanges }
});

// Hook for fetching entity facets (for filters)
export const useEntityFacets = (workspaceId: string, enabled = true) => {
  return useQuery(entityFacetsQuery(workspaceId, enabled));
};

// Hook for fetching timeline markers (future_update target dates, saved_version promotions)
// used to plot event markers in the "browse as of date" picker.
export const useTimelineMarkers = (workspaceId: string, enabled = true) => {
  return useQuery(entityTimelineMarkersQuery(workspaceId, enabled));
};

export const useEntityCount = (
  workspaceId: string,
  options: EntityListOptions = {},
  queryOptions?: { enabled?: boolean }
) => useQuery(entityCountQuery(workspaceId, options, queryOptions?.enabled ?? true));

// Hook for fetching entity relations
export const useEntityRelations = (workspaceId: string, entityId: string) => {
  return useQuery(entityRelationsQuery(workspaceId, entityId));
};

// Hook for fetching entity dependents (direct or transitive)
export const useEntityDependents = (workspaceId: string, entityId: string, transitive: boolean) => {
  return useQuery(entityDependentsQuery(workspaceId, entityId, transitive));
};

// Hook for fetching entity tree
export const useEntityTree = (
  workspaceId: string,
  options: EntityListOptions = {},
  enabled = true
) => useQuery(entityTreeQuery(workspaceId, options, enabled));

// Hook for deleting an entity
export const useDeleteEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.entities.remove({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async (_, entityId) => {
      await invalidateEntityDeletion(queryClient, workspaceId, entityId);
    }
  });
};

// Hook for updating an entity
export const useUpdateEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      orpcClient.entities.update({
        params: { workspace: workspaceId, id: entityId },
        body: data
      }),
    onSuccess: async (_, variables) => {
      await invalidateEntityDetails(queryClient, workspaceId, variables.entityId);
      await invalidateEntityQueries(queryClient, workspaceId);
      await invalidateEntityVersionQueries(queryClient, workspaceId, variables.entityId);
    }
  });
};

// Hook for cloning an entity
export const useCloneEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.entities.clone({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async () => {
      await invalidateEntityQueries(queryClient, workspaceId);
    }
  });
};

// Type for per-entity relation data returned by useMultipleEntityRelations
export type EntityRelationData = {
  outgoing: EntityRelation[];
  incoming: EntityRelation[];
  isLoading: boolean;
};

// Hook for fetching relations for multiple entities at once (single batch request)
export const useMultipleEntityRelations = (
  workspaceId: string,
  entityIds: string[]
): Map<string, EntityRelationData> => {
  const sortedIds = useMemo(() => [...entityIds].sort(), [entityIds]);

  const { data, isLoading } = useQuery(entityBatchRelationsQuery(workspaceId, sortedIds));

  return useMemo(() => {
    const map = new Map<string, EntityRelationData>();
    for (const id of entityIds) {
      const rel = data?.[id];
      map.set(id, {
        outgoing: rel?.outgoing ?? [],
        incoming: rel?.incoming ?? [],
        isLoading
      });
    }
    return map;
  }, [data, isLoading, entityIds]);
};

// Batch-fetches full entity summaries for a set of ids in a single request (via the `_id`/`in`
// predicate), unlike `useEntitiesByIds` below which issues one detail request per id - use this
// when callers need full record fields (icon, owner, lifecycle, ...), not just name/publicId, for
// potentially many ids at once (e.g. hydrating every node across a map's matched relation chains).
export const useEntitiesByIdSet = (
  workspaceId: string,
  ids: string[],
  queryOptions?: { enabled?: boolean }
) => {
  const sortedIds = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const enabled = (queryOptions?.enabled ?? true) && sortedIds.length > 0;
  const query = useEntities(
    workspaceId,
    {
      view: 'full',
      entityQuery: { root: { kind: 'predicate', path: [], fieldId: '_id', op: 'in', value: sortedIds } },
      limit: sortedIds.length
    },
    { enabled }
  );

  return useMemo(() => {
    const map = new Map<string, (typeof query.data)[number]>();
    for (const entity of query.data) map.set(entity._uid, entity);
    return map;
  }, [query.data]);
};

// Hook for resolving a set of entity ids to their name/publicId (e.g. to render entityRelation
// field values as links instead of raw ids). Shares its cache with useEntity via entityKeys.detail.
export const useEntitiesByIds = (
  workspaceId: string,
  ids: string[]
): Map<string, { name: string; publicId: string }> => {
  const sortedIds = useMemo(() => [...new Set(ids)].sort(), [ids]);

  const results = useQueries({
    queries: sortedIds.map(id => entityDetailQuery(workspaceId, id))
  });

  return useMemo(() => {
    const map = new Map<string, { name: string; publicId: string }>();
    sortedIds.forEach((id, index) => {
      const entity = results[index]?.data;
      if (entity) map.set(id, { name: entity._name, publicId: entity._publicId });
    });
    return map;
  }, [results, sortedIds]);
};

// Hook for fetching entities by multiple schema IDs
export const useEntitiesBySchema = (
  workspaceId: string,
  schemaIds: string[],
  conditions: FilterCondition[] = []
) => {
  return useQueries({
    queries: schemaIds.map(schemaId => entitiesBySchemaQuery(workspaceId, schemaId, conditions))
  });
};

export const useEntityCountsBySchema = (
  workspaceId: string,
  schemaIds: string[],
  conditions: FilterCondition[] = []
) => {
  return useQueries({
    queries: schemaIds.map(schemaId => entityCountsBySchemaQuery(workspaceId, schemaId, conditions))
  });
};
