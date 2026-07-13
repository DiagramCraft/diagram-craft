import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateDeletedSchema, schemaKeys } from '../queries/schemas';
import { invalidateEntityQueries } from '../queries/entities';
import { invalidateAuditQueries } from '../queries/audit';
import { workspaceAnalyticsKeys } from '../queries/workspaceAnalytics';
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
    mutationFn: (body: { name: string; key_prefix: string; fields: SchemaField[] }) =>
      orpcClient.schemas.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      // Invalidate schema list to show the new schema
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
      await queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) });
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
        key_prefix: string;
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
      // Completeness scores and entity type icons/colours are derived from the schema
      await invalidateEntityQueries(queryClient, workspaceId);
      await queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) });
    }
  });
};

// Hook for deleting a schema
export const useDeleteSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (schemaId: string) =>
      orpcClient.schemas.remove({ params: { workspace: workspaceId, id: schemaId } }),
    onSuccess: async (_, schemaId) => {
      await invalidateDeletedSchema(queryClient, workspaceId, schemaId);
      await invalidateEntityQueries(queryClient, workspaceId);
      await queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) });
    }
  });
};
