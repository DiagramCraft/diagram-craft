import type { QueryClient } from '@tanstack/react-query';

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

export const invalidateDeletedRelationSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  relationSchemaId: string
) => {
  await queryClient.invalidateQueries({ queryKey: relationSchemaKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: relationSchemaKeys.detail(workspaceId, relationSchemaId) });
};
