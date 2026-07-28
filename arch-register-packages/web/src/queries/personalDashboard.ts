import type { QueryClient } from '@tanstack/react-query';

export const personalDashboardKeys = {
  all: ['personalDashboard'] as const,
  lists: () => [...personalDashboardKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...personalDashboardKeys.lists(), workspaceId] as const,
  detail: (workspaceId: string, id: string) =>
    [...personalDashboardKeys.list(workspaceId), id] as const
};

export const invalidatePersonalDashboardQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: personalDashboardKeys.list(workspaceId) });
