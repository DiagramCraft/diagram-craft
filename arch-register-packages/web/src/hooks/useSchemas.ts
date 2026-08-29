import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidateSchemaCreate,
  invalidateSchemaDeletion,
  invalidateSchemaUpdate,
  optimisticallyUpdateSchema,
  restoreSchemaCache,
  schemaVersionsQuery,
  schemasQuery,
  setSchemaCaches,
  type SchemaUpdateCacheInput
} from '../queries/schemas';
import {
  DetailLayoutConfig,
  EntityTemplate,
  FieldMigrations,
  SchemaField,
  SchemaGroup,
  SchemaMigrationRequiredError,
  SharedFieldGroupLink,
  ValidationRule
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
  return useQuery(schemasQuery(workspaceSlug, enabled));
};

// Hook for creating a schema
export const useCreateSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      key_prefix: string;
      category_id?: string | null;
      description?: string;
      fields: SchemaField[];
      templates?: EntityTemplate[];
      groups?: SchemaGroup[];
      shared_field_group_links?: SharedFieldGroupLink[];
      validation_rules?: ValidationRule[];
      detail_layout?: DetailLayoutConfig | null;
      color?: string | null;
      icon?: string | null;
    }) => orpcClient.schemas.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async () => {
      await invalidateSchemaCreate(queryClient, workspaceId);
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
        category_id?: string | null;
        description?: string;
        fields: SchemaField[];
        templates?: EntityTemplate[];
        groups?: SchemaGroup[];
        shared_field_group_links?: SharedFieldGroupLink[];
        validation_rules?: ValidationRule[];
        detail_layout?: DetailLayoutConfig | null;
        color?: string | null;
        icon?: string | null;
        fieldMigrations?: FieldMigrations;
      };
    }) =>
      orpcClient.schemas.update({ params: { workspace: workspaceId, id: schemaId }, body: data }),
    onMutate: async variables => {
      return optimisticallyUpdateSchema(
        queryClient,
        workspaceId,
        variables.schemaId,
        variables.data as SchemaUpdateCacheInput
      );
    },
    onError: (_error, _variables, context) => {
      restoreSchemaCache(queryClient, workspaceId, context);
    },
    onSuccess: async (updated, variables) => {
      setSchemaCaches(queryClient, workspaceId, variables.schemaId, updated);
      await invalidateSchemaUpdate(queryClient, workspaceId, variables.schemaId);
    }
  });
};

export const usePreviewSchemaValidation = (workspaceId: string) =>
  useMutation({
    mutationFn: ({
      schemaId,
      validation_rules
    }: {
      schemaId: string;
      validation_rules: NonNullable<EntitySchema['validation_rules']>;
    }) =>
      orpcClient.schemas.previewValidation({
        params: { workspace: workspaceId, id: schemaId },
        body: { validation_rules }
      })
  });

// Hook for fetching a schema's version history
export const useSchemaVersions = (workspaceId: string, schemaId: string | null) => {
  return useQuery(schemaVersionsQuery(workspaceId, schemaId));
};

// Hook for deleting a schema
export const useDeleteSchema = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (schemaId: string) =>
      orpcClient.schemas.remove({ params: { workspace: workspaceId, id: schemaId } }),
    onSuccess: async (_, schemaId) => {
      await invalidateSchemaDeletion(queryClient, workspaceId, schemaId);
    }
  });
};
