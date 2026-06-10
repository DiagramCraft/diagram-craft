import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityKeys, schemaKeys } from './queryKeys';
import { invalidateAuditQueries } from './useAudit';
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching schemas
export const useSchemas = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: schemaKeys.list(workspaceSlug),
    queryFn: async () => orpcClient.schemas.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

// Hook for creating a schema
export const useCreateSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; fields: SchemaField[] }) =>
      orpcClient.schemas.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      // Invalidate schema list to show the new schema
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for updating a schema
export const useUpdateSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      schemaId,
      data
    }: {
      schemaId: string;
      data: {
        name: string;
        description?: string;
        fields: SchemaField[];
        color?: string | null;
        icon?: string | null;
      };
    }) => orpcClient.schemas.update({ params: { workspace: workspaceId, id: schemaId }, body: data }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: schemaKeys.detail(workspaceId, variables.schemaId)
      });
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      // Completeness scores are computed server-side from the schema, so entity lists must be refreshed too
      await queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: entityKeys.facets(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for deleting a schema
export const useDeleteSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (schemaId: string) =>
      orpcClient.schemas.remove({ params: { workspace: workspaceId, id: schemaId } }),
    onSuccess: async () => {
      // Invalidate all schema queries
      await queryClient.invalidateQueries({ queryKey: schemaKeys.all });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
