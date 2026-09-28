import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  lists: () => [...dashboardKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...dashboardKeys.lists(), workspaceId] as const,
  app: (workspaceId: string, appKey: string) =>
    [...dashboardKeys.list(workspaceId), 'app', appKey] as const,
  detail: (workspaceId: string, id: string) => [...dashboardKeys.list(workspaceId), id] as const
};

export const workspaceDashboardsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: dashboardKeys.list(workspaceId),
    queryFn: () => orpcClient.dashboards.list({ params: { workspace: workspaceId } }),
    enabled: workspaceId !== ''
  });

export const appDashboardQuery = (workspaceId: string, appKey: string) =>
  queryOptions({
    queryKey: dashboardKeys.app(workspaceId, appKey),
    queryFn: () => orpcClient.dashboards.getApp({ params: { workspace: workspaceId, appKey } }),
    enabled: workspaceId !== ''
  });

export const invalidateDashboardQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: dashboardKeys.list(workspaceId) });
