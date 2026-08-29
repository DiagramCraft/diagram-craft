import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidateDeletedRelationSchema,
  invalidateRelationSchemaCreate,
  invalidateRelationSchemaUpdate,
  optimisticallyUpdateRelationSchema,
  restoreRelationSchemaCache,
  relationSchemaVersionsQuery,
  relationSchemasQuery,
  setRelationSchemaCaches,
  type RelationSchemaUpdateCacheInput
} from '../queries/relationSchemas';
import type {
  FieldMigrations,
  SchemaMigrationRequiredError
} from '@arch-register/api-types/schemaContract';
import type {
  RelationField,
  RelationEndpoint,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroupLink, ValidationRule } from '@arch-register/api-types/schemaContract';
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
  return useQuery(relationSchemasQuery(workspaceSlug, enabled));
};

// Hook for creating a relation schema
export const useCreateRelationSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      category_id?: string | null;
      description?: string;
      in: RelationEndpoint;
      out: RelationEndpoint;
      fields?: RelationField[];
      groups?: RelationSchemaGroup[];
      shared_field_group_links?: SharedFieldGroupLink[];
      validation_rules?: ValidationRule[];
      color?: string | null;
      icon?: string | null;
    }) => orpcClient.relationSchemas.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      await invalidateRelationSchemaCreate(queryClient, workspaceId);
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
        category_id?: string | null;
        description?: string;
        in: RelationEndpoint;
        out: RelationEndpoint;
        fields?: RelationField[];
        groups?: RelationSchemaGroup[];
        shared_field_group_links?: SharedFieldGroupLink[];
        validation_rules?: ValidationRule[];
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
      return optimisticallyUpdateRelationSchema(
        queryClient,
        workspaceId,
        variables.relationSchemaId,
        variables.data as RelationSchemaUpdateCacheInput
      );
    },
    onError: (_error, _variables, context) => {
      restoreRelationSchemaCache(queryClient, workspaceId, context);
    },
    onSuccess: async (updated, variables) => {
      setRelationSchemaCaches(queryClient, workspaceId, variables.relationSchemaId, updated);
      await invalidateRelationSchemaUpdate(queryClient, workspaceId, variables.relationSchemaId);
    }
  });
};

// Hook for fetching a relation schema's version history
export const useRelationSchemaVersions = (workspaceId: string, relationSchemaId: string | null) => {
  return useQuery(relationSchemaVersionsQuery(workspaceId, relationSchemaId));
};

// Hook for deleting a relation schema
export const useDeleteRelationSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (relationSchemaId: string) =>
      orpcClient.relationSchemas.remove({
        params: { workspace: workspaceId, id: relationSchemaId }
      }),
    onSuccess: async (_, relationSchemaId) => {
      await invalidateDeletedRelationSchema(queryClient, workspaceId, relationSchemaId);
    }
  });
};
