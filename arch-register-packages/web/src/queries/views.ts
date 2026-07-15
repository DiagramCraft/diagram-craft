import type { QueryClient } from '@tanstack/react-query';

export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...viewKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, options?: { projectId?: string; includeWorkspace?: boolean }) =>
    [...viewKeys.workspaceLists(workspaceId), options ?? {}] as const
};

export const invalidateSavedViewQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: viewKeys.workspaceLists(workspaceId) });
