import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  fetchEntities,
  fetchEntity,
  fetchEntityFacets,
  fetchEntityRelations,
  fetchEntityTree,
  deleteEntity,
  cloneEntity,
} from '../api';
import { schemaKeys } from './useSchemas';

// Query keys factory for better organization and type safety
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.lists(), workspaceId, filters] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (workspaceId: string, entityId: string) =>
    [...entityKeys.details(), workspaceId, entityId] as const,
  facets: (workspaceId: string) => [...entityKeys.all, 'facets', workspaceId] as const,
  relations: (workspaceId: string, entityId: string) =>
    [...entityKeys.all, 'relations', workspaceId, entityId] as const,
  tree: (workspaceId: string, filters: Record<string, unknown>) =>
    [...entityKeys.all, 'tree', workspaceId, filters] as const,
};

// Hook for fetching entity list
export const useEntities = (
  workspaceId: string,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    view?: 'summary' | 'full';
    limit?: number | null;
    offset?: number | null;
  } = {}
) => {
  return useQuery({
    queryKey: entityKeys.list(workspaceId, options),
    queryFn: () => fetchEntities(workspaceId, options),
    enabled: !!workspaceId,
  });
};

// Hook for fetching a single entity
export const useEntity = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.detail(workspaceId, entityId),
    queryFn: () => fetchEntity(workspaceId, entityId),
    enabled: !!workspaceId && !!entityId,
  });
};

// Hook for fetching entity facets (for filters)
export const useEntityFacets = (workspaceId: string) => {
  return useQuery({
    queryKey: entityKeys.facets(workspaceId),
    queryFn: () => fetchEntityFacets(workspaceId),
    enabled: !!workspaceId,
  });
};

// Hook for fetching entity relations
export const useEntityRelations = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.relations(workspaceId, entityId),
    queryFn: () => fetchEntityRelations(workspaceId, entityId),
    enabled: !!workspaceId && !!entityId,
  });
};

// Hook for fetching entity tree
export const useEntityTree = (
  workspaceId: string,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
  } = {}
) => {
  return useQuery({
    queryKey: entityKeys.tree(workspaceId, options),
    queryFn: () => fetchEntityTree(workspaceId, options),
    enabled: !!workspaceId,
  });
};

// Hook for deleting an entity
export const useDeleteEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) => deleteEntity(workspaceId, entityId),
    onSuccess: () => {
      // Invalidate all entity-related queries to refetch
      queryClient.invalidateQueries({ queryKey: entityKeys.all });
      // Invalidate schema queries to update entity counts in sidebar
      queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
    },
  });
};

// Hook for updating an entity
export const useUpdateEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityId, data }: { entityId: string; data: Record<string, unknown> }) =>
      apiFetch(`/api/${workspaceId}/data/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      // Invalidate the specific entity and relations
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, variables.entityId) });
      queryClient.invalidateQueries({ queryKey: entityKeys.relations(workspaceId, variables.entityId) });
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
};

// Hook for cloning an entity
export const useCloneEntity = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) => cloneEntity(workspaceId, entityId),
    onSuccess: () => {
      // Invalidate entity lists to show the new clone
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
};

// Hook for fetching entities by multiple schema IDs
export const useEntitiesBySchema = (workspaceId: string, schemaIds: string[]) => {
  return useQueries({
    queries: schemaIds.map(schemaId => ({
      queryKey: entityKeys.list(workspaceId, { schemaId, view: 'summary' }),
      queryFn: () => fetchEntities(workspaceId, { schemaId, view: 'summary' }),
      enabled: !!workspaceId && !!schemaId,
    })),
  });
};
