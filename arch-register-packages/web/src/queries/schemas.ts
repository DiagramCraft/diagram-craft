import type { QueryClient } from '@tanstack/react-query';

export const schemaKeys = {
  all: ['schemas'] as const,
  lists: () => [...schemaKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...schemaKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => schemaKeys.workspaceLists(workspaceId),
  details: () => [...schemaKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...schemaKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, schemaId: string) =>
    [...schemaKeys.workspaceDetails(workspaceId), schemaId] as const
};

export const invalidateDeletedSchema = async (
  queryClient: QueryClient,
  workspaceId: string,
  schemaId: string
) => {
  await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: schemaKeys.detail(workspaceId, schemaId) });
};
