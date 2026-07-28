import type { QueryClient } from '@tanstack/react-query';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  lists: () => [...dashboardKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...dashboardKeys.lists(), workspaceId] as const,
  detail: (workspaceId: string, id: string) => [...dashboardKeys.list(workspaceId), id] as const
};

export const invalidateDashboardQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: dashboardKeys.list(workspaceId) });
