import type { QueryClient } from '@tanstack/react-query';

export const collectionKeys = {
  all: ['collections'] as const,
  workspaceLists: (workspaceId: string) => [...collectionKeys.all, 'list', workspaceId] as const,
  list: (workspaceId: string, entityId?: string) =>
    [...collectionKeys.workspaceLists(workspaceId), entityId ?? null] as const
};

export const invalidateCollectionQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await queryClient.invalidateQueries({ queryKey: collectionKeys.workspaceLists(workspaceId) });
};
