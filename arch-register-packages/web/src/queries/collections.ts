import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const collectionKeys = {
  all: ['collections'] as const,
  workspaceLists: (workspaceId: string) => [...collectionKeys.all, 'list', workspaceId] as const,
  list: (workspaceId: string, entityId?: string) =>
    [...collectionKeys.workspaceLists(workspaceId), entityId ?? null] as const
};

export const collectionsQuery = (workspaceId: string, entityId?: string | null, enabled = true) =>
  queryOptions({
    queryKey: collectionKeys.list(workspaceId, entityId ?? undefined),
    queryFn: () =>
      orpcClient.collections.list({
        params: { workspace: workspaceId },
        query: entityId ? { entityId } : undefined
      }),
    enabled: enabled && !!workspaceId
  });

export const invalidateCollectionQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await queryClient.invalidateQueries({ queryKey: collectionKeys.workspaceLists(workspaceId) });
};
