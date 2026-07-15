import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateDeletedSchema, schemaKeys } from '../queries/schemas';
import { invalidateEntityQueries } from '../queries/entities';
import { invalidateAuditQueries } from '../queries/audit';
import { workspaceAnalyticsKeys } from '../queries/workspaceAnalytics';
import { EntityTemplate, SchemaField } from '@arch-register/api-types/schemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
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
      await queryClient.invalidateQueries({
        queryKey: workspaceAnalyticsKeys.workspace(workspaceId)
      });
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
        templates?: EntityTemplate[];
        color?: string | null;
        icon?: string | null;
      };
    }) =>
      orpcClient.schemas.update({ params: { workspace: workspaceId, id: schemaId }, body: data }),
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey: schemaKeys.list(workspaceId) });
      const previous = queryClient.getQueryData<EntitySchema[]>(schemaKeys.list(workspaceId));
      queryClient.setQueryData<EntitySchema[]>(
        schemaKeys.list(workspaceId),
        current =>
          current?.map(schema =>
            schema.id === variables.schemaId
              ? {
                  ...schema,
                  name: variables.data.name,
                  key_prefix: variables.data.key_prefix,
                  description: variables.data.description ?? schema.description,
                  fields: variables.data.fields as EntitySchema['fields'],
                  templates: variables.data.templates ?? schema.templates,
                  color: variables.data.color ?? schema.color,
                  icon: variables.data.icon ?? schema.icon
                }
              : schema
          ) ?? current
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(schemaKeys.list(workspaceId), context.previous);
      }
    },
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<EntitySchema[]>(
        schemaKeys.list(workspaceId),
        current => current?.map(schema => (schema.id === updated.id ? updated : schema)) ?? current
      );
      queryClient.setQueryData(schemaKeys.detail(workspaceId, variables.schemaId), updated);
      await queryClient.invalidateQueries({
        queryKey: schemaKeys.detail(workspaceId, variables.schemaId)
      });
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
      // Completeness scores and entity type icons/colours are derived from the schema
      await invalidateEntityQueries(queryClient, workspaceId);
      await queryClient.invalidateQueries({
        queryKey: workspaceAnalyticsKeys.workspace(workspaceId)
      });
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
      await queryClient.invalidateQueries({
        queryKey: workspaceAnalyticsKeys.workspace(workspaceId)
      });
    }
  });
};
