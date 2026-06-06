import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EntitySchema, SchemaField } from '../api';
import { apiFetch } from '../api';
import { entityKeys } from './useEntities';

// Query keys factory
export const schemaKeys = {
  all: ['schemas'] as const,
  lists: () => [...schemaKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...schemaKeys.lists(), workspaceId] as const,
  details: () => [...schemaKeys.all, 'detail'] as const,
  detail: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.details(), workspaceId, schemaId] as const,
};

// Hook for fetching schemas
export const useSchemas = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: schemaKeys.list(workspaceSlug),
    queryFn: async () => {
      return await apiFetch<EntitySchema[]>(`/api/${workspaceSlug}/schemas`);
    },
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for creating a schema
export const useCreateSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; fields: SchemaField[] }) =>
      apiFetch<EntitySchema>(`/api/${workspaceId}/schemas`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // Invalidate schema list to show the new schema
      queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
    },
  });
};

// Hook for updating a schema
export const useUpdateSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      schemaId,
      data,
    }: {
      schemaId: string;
      data: { name: string; description?: string; fields: SchemaField[]; color?: string | null; icon?: string | null };
    }) =>
      apiFetch<EntitySchema>(`/api/${workspaceId}/schemas/${schemaId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: schemaKeys.detail(workspaceId, variables.schemaId) });
      queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      // Completeness scores are computed server-side from the schema, so entity lists must be refreshed too
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
    },
  });
};

// Hook for deleting a schema
export const useDeleteSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (schemaId: string) =>
      apiFetch<{ success: boolean }>(`/api/${workspaceId}/schemas/${schemaId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      // Invalidate all schema queries
      queryClient.invalidateQueries({ queryKey: schemaKeys.all });
    },
  });
};