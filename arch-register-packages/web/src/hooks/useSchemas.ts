import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateDeletedSchema, schemaKeys } from '../queries/schemas';
import { invalidateEntityQueries } from '../queries/entities';
import { invalidateAuditQueries } from '../queries/audit';
import { workspaceAnalyticsKeys } from '../queries/workspaceAnalytics';
import {
  EntityTemplate,
  FieldMigrations,
  SchemaField,
  SchemaMigrationRequiredError
} from '@arch-register/api-types/schemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { orpcClient } from '../lib/orpcClient';
import { normalizeApiError } from '../lib/http';

/** Extracts the structured "migration required" payload from a failed schema update, if present. */
export const getSchemaMigrationRequired = (error: unknown): SchemaMigrationRequiredError | null => {
  const apiError = normalizeApiError(error);
  const data = apiError.data as { code?: string } | undefined;
  return data?.code === 'SCHEMA_MIGRATION_REQUIRED' ? (data as SchemaMigrationRequiredError) : null;
};

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
    mutationFn: (body: {
      name: string;
      key_prefix: string;
      fields: SchemaField[];
      entity_approval_policy?: 'required' | 'disabled';
    }) => orpcClient.schemas.create({ params: { workspace: workspaceId }, body }),
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
        entity_approval_policy?: 'required' | 'disabled';
        fieldMigrations?: FieldMigrations;
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
                  icon: variables.data.icon ?? schema.icon,
                  entity_approval_policy:
                    variables.data.entity_approval_policy ?? schema.entity_approval_policy
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
      await queryClient.invalidateQueries({
        queryKey: schemaKeys.versions(workspaceId, variables.schemaId)
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

// Hook for fetching a schema's version history
export const useSchemaVersions = (workspaceId: string, schemaId: string | null) => {
  return useQuery({
    queryKey: schemaKeys.versions(workspaceId, schemaId ?? ''),
    queryFn: async () =>
      orpcClient.schemas.listVersions({ params: { workspace: workspaceId, id: schemaId! } }),
    enabled: !!workspaceId && !!schemaId
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
