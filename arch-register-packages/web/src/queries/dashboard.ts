import type { QueryClient } from '@tanstack/react-query';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  workspace: (workspaceId: string) => [...dashboardKeys.all, workspaceId] as const
};

export const invalidateDashboardQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(workspaceId) });
