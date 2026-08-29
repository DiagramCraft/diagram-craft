import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { invalidateAuditQueries } from './audit';
import { invalidateRelationSchemaConsumers } from './relations';
import { orpcClient } from '../lib/orpcClient';

export const relationSchemaKeys = {
  all: ['relationSchemas'] as const,
  lists: () => [...relationSchemaKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...relationSchemaKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => relationSchemaKeys.workspaceLists(workspaceId),
  details: () => [...relationSchemaKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) =>
    [...relationSchemaKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, relationSchemaId: string) =>
    [...relationSchemaKeys.workspaceDetails(workspaceId), relationSchemaId] as const,
  versions: (workspaceId: string, relationSchemaId: string) =>
    [...relationSchemaKeys.detail(workspaceId, relationSchemaId), 'versions'] as const
};

export const relationSchemasQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: relationSchemaKeys.list(workspaceId),
    queryFn: () => orpcClient.relationSchemas.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const relationSchemaVersionsQuery = (workspaceId: string, relationSchemaId: string | null) =>
  queryOptions({
    queryKey: relationSchemaKeys.versions(workspaceId, relationSchemaId ?? ''),
    queryFn: () =>
      orpcClient.relationSchemas.listVersions({
        params: { workspace: workspaceId, id: relationSchemaId! }
      }),
    enabled: !!workspaceId && !!relationSchemaId
  });

export const invalidateDeletedRelationSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationSchemaId: string
) => {
  await queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: relationSchemaKeys.detail(workspaceId, relationSchemaId) });
};

export const invalidateRelationSchemaCreate = async (
  queryClient: QueryClient,
  workspaceId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);

export const invalidateRelationSchemaUpdate = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationSchemaId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) }),
    queryClient.invalidateQueries({
      queryKey: relationSchemaKeys.detail(workspaceId, relationSchemaId)
    }),
    queryClient.invalidateQueries({
      queryKey: relationSchemaKeys.versions(workspaceId, relationSchemaId)
    }),
    invalidateAuditQueries(queryClient, workspaceId),
    invalidateRelationSchemaConsumers(queryClient, workspaceId)
  ]);

export type RelationSchemaUpdateCacheInput = {
  name: string;
  category_id?: string | null;
  description?: string;
  in: unknown;
  out: unknown;
  fields?: unknown;
  groups?: unknown;
  shared_field_group_links?: unknown;
  validation_rules?: unknown;
  color?: string | null;
  icon?: string | null;
};

export type RelationSchemaCacheContext = { previous?: RelationSchema[] };

export const optimisticallyUpdateRelationSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationSchemaId: string,
  data: RelationSchemaUpdateCacheInput
): Promise<RelationSchemaCacheContext> => {
  await queryClient.cancelQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
  const previous = queryClient.getQueryData<RelationSchema[]>(relationSchemaKeys.list(workspaceId));
  queryClient.setQueryData<RelationSchema[]>(
    relationSchemaKeys.list(workspaceId),
    current =>
      current?.map(relationSchema =>
        relationSchema.id === relationSchemaId
          ? {
              ...relationSchema,
              name: data.name,
              description: data.description ?? relationSchema.description,
              in: data.in as RelationSchema['in'],
              out: data.out as RelationSchema['out'],
              fields:
                (data.fields as RelationSchema['fields'] | undefined) ?? relationSchema.fields,
              groups:
                (data.groups as RelationSchema['groups'] | undefined) ?? relationSchema.groups,
              shared_field_group_links:
                (data.shared_field_group_links as
                  | RelationSchema['shared_field_group_links']
                  | undefined) ?? relationSchema.shared_field_group_links,
              validation_rules:
                (data.validation_rules as RelationSchema['validation_rules'] | undefined) ??
                relationSchema.validation_rules,
              color: data.color ?? relationSchema.color,
              icon: data.icon ?? relationSchema.icon
            }
          : relationSchema
      ) ?? current
  );
  return { previous };
};

export const restoreRelationSchemaCache = (
  queryClient: QueryClient,
  workspaceId: string,
  context: RelationSchemaCacheContext | undefined
) => {
  if (context?.previous) {
    queryClient.setQueryData(relationSchemaKeys.list(workspaceId), context.previous);
  }
};

export const setRelationSchemaCaches = (
  queryClient: QueryClient,
  workspaceId: string,
  relationSchemaId: string,
  updated: RelationSchema
) => {
  queryClient.setQueryData<RelationSchema[]>(
    relationSchemaKeys.list(workspaceId),
    current =>
      current?.map(relationSchema =>
        relationSchema.id === updated.id ? updated : relationSchema
      ) ?? current
  );
  queryClient.setQueryData(relationSchemaKeys.detail(workspaceId, relationSchemaId), updated);
};
