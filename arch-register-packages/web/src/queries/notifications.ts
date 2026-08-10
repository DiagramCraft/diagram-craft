import type { QueryClient } from '@tanstack/react-query';

export const notificationKeys = {
  all: ['notifications'] as const,
  watched: (workspaceId: string) => [...notificationKeys.all, 'watching', workspaceId] as const,
  pinned: (workspaceId: string) => [...notificationKeys.all, 'pinned', workspaceId] as const,
  list: (workspaceId: string) => [...notificationKeys.all, 'list', workspaceId] as const,
  count: (workspaceId: string) => [...notificationKeys.all, 'count', workspaceId] as const
};

export const invalidateNotificationQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: notificationKeys.watched(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.pinned(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: notificationKeys.count(workspaceId) })
  ]);
};
