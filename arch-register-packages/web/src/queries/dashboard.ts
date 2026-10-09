import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateApplicationQueries } from './application';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  lists: () => [...dashboardKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...dashboardKeys.lists(), workspaceId] as const,
  detail: (workspaceId: string, id: string) => [...dashboardKeys.list(workspaceId), id] as const
};

export const workspaceDashboardsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: dashboardKeys.list(workspaceId),
    queryFn: () => orpcClient.dashboards.list({ params: { workspace: workspaceId } }),
    enabled: workspaceId !== ''
  });

export const workspaceDashboardQuery = (workspaceId: string, id: string) =>
  queryOptions({
    queryKey: dashboardKeys.detail(workspaceId, id),
    queryFn: () => orpcClient.dashboards.get({ params: { workspace: workspaceId, id } }),
    enabled: workspaceId !== '' && id !== ''
  });

export const invalidateDashboardQueries = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardKeys.list(workspaceId) }),
    // Application dashboards carry their name, icon and sidebar in the application list.
    invalidateApplicationQueries(queryClient, workspaceId)
  ]);
