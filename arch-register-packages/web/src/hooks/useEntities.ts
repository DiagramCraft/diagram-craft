import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityRelation } from '@arch-register/api-types/entityContract';
import { toEntityListQuery, type EntityListOptions } from './entityListQuery';
import {
  entityKeys,
  invalidateEntityDetails,
  invalidateEntityQueries,
  invalidateDeletedEntity
} from '../queries/entities';
import { schemaKeys } from '../queries/schemas';
import { invalidateSnapshotQueries } from '../queries/snapshots';
import { invalidateNotificationQueries } from './useNotifications';
import { orpcClient } from '../lib/orpcClient';

export const useEntities = (
  workspaceId: string,
  options: EntityListOptions = {},
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery({
    queryKey: entityKeys.list(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: {
          ...toEntityListQuery(options),
          view: options.view,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
  });

  return {
    ...query,
    data: query.data?.items ?? [],
    total: query.data?.total
  };
};

// Hook for fetching a single entity
export const useEntity = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.detail(workspaceId, entityId),
    queryFn: () => orpcClient.entities.get({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching entity facets (for filters)
export const useEntityFacets = (workspaceId: string) => {
  return useQuery({
    queryKey: entityKeys.facets(workspaceId),
    queryFn: () => orpcClient.entities.facets({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

// Hook for fetching timeline markers (future_update target dates, saved_version promotions)
// used to plot event markers in the "browse as of date" picker.
export const useTimelineMarkers = (workspaceId: string, enabled = true) => {
  return useQuery({
    queryKey: entityKeys.timelineMarkers(workspaceId),
    queryFn: () => orpcClient.entities.timelineMarkers({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId
  });
};

export const useEntityCount = (
  workspaceId: string,
  options: EntityListOptions = {},
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: entityKeys.count(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.count({
        params: { workspace: workspaceId },
        query: toEntityListQuery(options)
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
  });
};

// Hook for fetching entity relations
export const useEntityRelations = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.relations(workspaceId, entityId),
    queryFn: () =>
      orpcClient.entities.relations({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching entity dependents (direct or transitive)
export const useEntityDependents = (workspaceId: string, entityId: string, transitive: boolean) => {
  return useQuery({
    queryKey: entityKeys.dependents(workspaceId, entityId, transitive),
    queryFn: () =>
      orpcClient.entities.dependents({
        params: { workspace: workspaceId, id: entityId },
        query: { transitive: transitive ? 'true' : 'false' }
      }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching entity tree
export const useEntityTree = (workspaceId: string, options: EntityListOptions = {}) => {
  return useQuery({
    queryKey: entityKeys.tree(workspaceId, options),
    queryFn: () =>
      orpcClient.entities.tree({
        params: { workspace: workspaceId },
        query: toEntityListQuery(options)
      }),
    enabled: !!workspaceId
  });
};

// Hook for deleting an entity
export const useDeleteEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.entities.remove({ params: { workspace: workspaceId, id: entityId } }),
    onSuccess: async (_, entityId) => {
      await invalidateDeletedEntity(queryClient, workspaceId, entityId);
      // Schema counts change when an entity is removed
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      await invalidateNotificationQueries(queryClient, workspaceId);
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
      await invalidateSnapshotQueries(queryClient, workspaceId, variables.entityId);
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

  const { data, isLoading } = useQuery({
    queryKey: entityKeys.batchRelations(workspaceId, sortedIds),
    queryFn: () =>
      orpcClient.entities.batchRelations({
        params: { workspace: workspaceId },
        body: { ids: sortedIds }
      }),
    enabled: !!workspaceId && sortedIds.length > 0
  });

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

// Hook for fetching entities by multiple schema IDs
export const useEntitiesBySchema = (
  workspaceId: string,
  schemaIds: string[],
  conditions: FilterCondition[] = []
) => {
  return useQueries({
    queries: schemaIds.map(schemaId => ({
      queryKey: entityKeys.list(workspaceId, { schemaId, view: 'summary', conditions }),
      queryFn: async () => {
        const page = await orpcClient.entities.list({
          params: { workspace: workspaceId },
          query: { ...toEntityListQuery({ schemaId, conditions }), view: 'summary' }
        });
        return page.items;
      },
      enabled: !!workspaceId && !!schemaId
    }))
  });
};

export const useEntityCountsBySchema = (
  workspaceId: string,
  schemaIds: string[],
  conditions: FilterCondition[] = []
) => {
  return useQueries({
    queries: schemaIds.map(schemaId => ({
      queryKey: entityKeys.count(workspaceId, { schemaId, conditions }),
      queryFn: () =>
        orpcClient.entities.count({
          params: { workspace: workspaceId },
          query: toEntityListQuery({ schemaId, conditions })
        }),
      enabled: !!workspaceId && !!schemaId
    }))
  });
};
