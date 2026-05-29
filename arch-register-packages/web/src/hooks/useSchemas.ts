import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api';
import type { EntitySchema } from '../api';

export const useSchemas = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: ['workspaces', workspaceSlug, 'schemas'],
    queryFn: async () => {
      const schemas = await apiFetch<EntitySchema[]>(`/api/${workspaceSlug}/schemas`);
      return schemas;
    },
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateSchema = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; fields: EntitySchema['fields'] }) => {
      const schema = await apiFetch<EntitySchema>(`/api/${workspaceSlug}/schemas`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return schema;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug, 'schemas'] });
    },
  });
};

export const useUpdateSchema = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ schemaId, data }: { schemaId: string; data: Partial<EntitySchema> }) => {
      const schema = await apiFetch<EntitySchema>(`/api/${workspaceSlug}/schemas/${schemaId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return schema;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug, 'schemas'] });
    },
  });
};

export const useDeleteSchema = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schemaId: string) => {
      await apiFetch(`/api/${workspaceSlug}/schemas/${schemaId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug, 'schemas'] });
    },
  });
};
