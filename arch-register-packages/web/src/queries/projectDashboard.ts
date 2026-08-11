import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const projectDashboardKeys = {
  all: ['projectDashboard'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectDashboardKeys.all, workspaceId, projectId] as const
};

export const projectDashboardQuery = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: projectDashboardKeys.detail(workspaceId, projectId),
    queryFn: () =>
      orpcClient.projectDashboard.get({ params: { workspace: workspaceId, projectId } }),
    enabled: workspaceId !== '' && projectId !== ''
  });

export const invalidateProjectDashboardQueries = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string
) =>
  queryClient.invalidateQueries({ queryKey: projectDashboardKeys.detail(workspaceId, projectId) });
