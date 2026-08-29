import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { invalidateAuditQueries } from './audit';
import { invalidateEntityQueries } from './entities';
import { schemaKeys as schemaKeysFromQueries } from './schemaKeys';
import { workspaceAnalyticsKeys } from './workspaceAnalytics';
import { orpcClient } from '../lib/orpcClient';

export const schemaKeys = schemaKeysFromQueries;

export const schemasQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: schemaKeys.list(workspaceId),
    queryFn: () => orpcClient.schemas.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const schemaVersionsQuery = (workspaceId: string, schemaId: string | null) =>
  queryOptions({
    queryKey: schemaKeys.versions(workspaceId, schemaId ?? ''),
    queryFn: () =>
      orpcClient.schemas.listVersions({ params: { workspace: workspaceId, id: schemaId! } }),
    enabled: !!workspaceId && !!schemaId
  });

export const invalidateSchemaList = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });

export const invalidateSchemaCreate = async (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    invalidateSchemaList(queryClient, workspaceId),
    invalidateAuditQueries(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) })
  ]);

export const invalidateSchemaUpdate = async (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string
) =>
  Promise.all([
    invalidateSchemaList(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: schemaKeys.detail(workspaceId, schemaId) }),
    queryClient.invalidateQueries({ queryKey: schemaKeys.versions(workspaceId, schemaId) }),
    invalidateEntityQueries(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) })
  ]);

export const invalidateDeletedSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string
) => {
  await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: schemaKeys.detail(workspaceId, schemaId) });
};

export const invalidateSchemaDeletion = async (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string
) =>
  Promise.all([
    invalidateDeletedSchema(queryClient, workspaceId, schemaId),
    invalidateEntityQueries(queryClient, workspaceId),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) })
  ]);

export type SchemaUpdateCacheInput = {
  name: string;
  key_prefix: string;
  category_id?: string | null;
  description?: string;
  fields: unknown;
  templates?: unknown;
  groups?: unknown;
  shared_field_group_links?: unknown;
  validation_rules?: unknown;
  detail_layout?: unknown;
  color?: string | null;
  icon?: string | null;
};

export type SchemaCacheContext = { previous?: EntitySchema[] };

export const optimisticallyUpdateSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string,
  data: SchemaUpdateCacheInput
): Promise<SchemaCacheContext> => {
  await queryClient.cancelQueries({ queryKey: schemaKeys.list(workspaceId) });
  const previous = queryClient.getQueryData<EntitySchema[]>(schemaKeys.list(workspaceId));
  queryClient.setQueryData<EntitySchema[]>(
    schemaKeys.list(workspaceId),
    current =>
      current?.map(schema =>
        schema.id === schemaId
          ? {
              ...schema,
              name: data.name,
              key_prefix: data.key_prefix,
              description: data.description ?? schema.description,
              fields: data.fields as EntitySchema['fields'],
              templates:
                (data.templates as EntitySchema['templates'] | undefined) ?? schema.templates,
              groups: (data.groups as EntitySchema['groups'] | undefined) ?? schema.groups,
              shared_field_group_links:
                (data.shared_field_group_links as
                  | EntitySchema['shared_field_group_links']
                  | undefined) ?? schema.shared_field_group_links,
              validation_rules:
                (data.validation_rules as EntitySchema['validation_rules'] | undefined) ??
                schema.validation_rules,
              detail_layout:
                data.detail_layout === undefined
                  ? schema.detail_layout
                  : ((data.detail_layout as EntitySchema['detail_layout'] | null) ?? undefined),
              color: data.color ?? schema.color,
              icon: data.icon ?? schema.icon
            }
          : schema
      ) ?? current
  );
  return { previous };
};

export const restoreSchemaCache = (
  queryClient: QueryClient,
  workspaceId: string,
  context: SchemaCacheContext | undefined
) => {
  if (context?.previous) queryClient.setQueryData(schemaKeys.list(workspaceId), context.previous);
};

export const setSchemaCaches = (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string,
  updated: EntitySchema
) => {
  queryClient.setQueryData<EntitySchema[]>(
    schemaKeys.list(workspaceId),
    current => current?.map(schema => (schema.id === updated.id ? updated : schema)) ?? current
  );
  queryClient.setQueryData(schemaKeys.detail(workspaceId, schemaId), updated);
};
