import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateDeletedRelationSchema, relationSchemaKeys } from '../queries/relationSchemas';
import { relationKeys } from '../queries/relations';
import { invalidateAuditQueries } from '../queries/audit';
import type { FieldMigrations, SchemaMigrationRequiredError } from '@arch-register/api-types/schemaContract';
import type {
  RelationField,
  RelationEndpoint,
  RelationSchema,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import { orpcClient } from '../lib/orpcClient';
import { normalizeApiError } from '../lib/http';

/** Extracts the structured "migration required" payload from a failed relation schema update, if present. */
export const getRelationSchemaMigrationRequired = (
  error: unknown
): SchemaMigrationRequiredError | null => {
  const apiError = normalizeApiError(error);
  const data = apiError.data as { code?: string } | undefined;
  return data?.code === 'SCHEMA_MIGRATION_REQUIRED' ? (data as SchemaMigrationRequiredError) : null;
};

// Hook for fetching relation schemas
export const useRelationSchemas = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: relationSchemaKeys.list(workspaceSlug),
    queryFn: async () => orpcClient.relationSchemas.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};

// Hook for creating a relation schema
export const useCreateRelationSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      in: RelationEndpoint;
      out: RelationEndpoint;
      fields?: RelationField[];
      groups?: RelationSchemaGroup[];
      shared_field_group_links?: SharedFieldGroupLink[];
      color?: string | null;
      icon?: string | null;
    }) => orpcClient.relationSchemas.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for updating a relation schema
export const useUpdateRelationSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      relationSchemaId,
      data
    }: {
      relationSchemaId: string;
      data: {
        name: string;
        description?: string;
        in: RelationEndpoint;
        out: RelationEndpoint;
        fields?: RelationField[];
        groups?: RelationSchemaGroup[];
        shared_field_group_links?: SharedFieldGroupLink[];
        color?: string | null;
        icon?: string | null;
        fieldMigrations?: FieldMigrations;
      };
    }) =>
      orpcClient.relationSchemas.update({
        params: { workspace: workspaceId, id: relationSchemaId },
        body: data
      }),
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
      const previous = queryClient.getQueryData<RelationSchema[]>(
        relationSchemaKeys.list(workspaceId)
      );
      queryClient.setQueryData<RelationSchema[]>(
        relationSchemaKeys.list(workspaceId),
        current =>
          current?.map(relationSchema =>
            relationSchema.id === variables.relationSchemaId
              ? {
                  ...relationSchema,
                  name: variables.data.name,
                  description: variables.data.description ?? relationSchema.description,
                  in: variables.data.in,
                  out: variables.data.out,
                  fields: (variables.data.fields ?? relationSchema.fields) as RelationSchema['fields'],
                  groups: variables.data.groups ?? relationSchema.groups,
                  shared_field_group_links:
                    variables.data.shared_field_group_links ??
                    relationSchema.shared_field_group_links,
                  color: variables.data.color ?? relationSchema.color,
                  icon: variables.data.icon ?? relationSchema.icon
                }
              : relationSchema
          ) ?? current
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(relationSchemaKeys.list(workspaceId), context.previous);
      }
    },
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData<RelationSchema[]>(
        relationSchemaKeys.list(workspaceId),
        current =>
          current?.map(relationSchema =>
            relationSchema.id === updated.id ? updated : relationSchema
          ) ?? current
      );
      queryClient.setQueryData(
        relationSchemaKeys.detail(workspaceId, variables.relationSchemaId),
        updated
      );
      await queryClient.invalidateQueries({
        queryKey: relationSchemaKeys.detail(workspaceId, variables.relationSchemaId)
      });
      await queryClient.invalidateQueries({
        queryKey: relationSchemaKeys.versions(workspaceId, variables.relationSchemaId)
      });
      await queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
      // Relation instances render field values defined by the relation schema
      await queryClient.invalidateQueries({ queryKey: relationKeys.all });
    }
  });
};

// Hook for fetching a relation schema's version history
export const useRelationSchemaVersions = (workspaceId: string, relationSchemaId: string | null) => {
  return useQuery({
    queryKey: relationSchemaKeys.versions(workspaceId, relationSchemaId ?? ''),
    queryFn: async () =>
      orpcClient.relationSchemas.listVersions({
        params: { workspace: workspaceId, id: relationSchemaId! }
      }),
    enabled: !!workspaceId && !!relationSchemaId
  });
};

// Hook for deleting a relation schema
export const useDeleteRelationSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (relationSchemaId: string) =>
      orpcClient.relationSchemas.remove({ params: { workspace: workspaceId, id: relationSchemaId } }),
    onSuccess: async (_, relationSchemaId) => {
      await invalidateDeletedRelationSchema(queryClient, workspaceId, relationSchemaId);
    }
  });
};
