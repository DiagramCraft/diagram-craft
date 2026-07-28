import type { QueryClient } from '@tanstack/react-query';

export const projectDashboardKeys = {
  all: ['projectDashboard'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectDashboardKeys.all, workspaceId, projectId] as const
};

export const invalidateProjectDashboardQueries = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string
) =>
  queryClient.invalidateQueries({ queryKey: projectDashboardKeys.detail(workspaceId, projectId) });
