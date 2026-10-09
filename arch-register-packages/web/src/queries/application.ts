import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const applicationKeys = {
  all: ['application'] as const,
  list: (workspaceId: string) => [...applicationKeys.all, 'list', workspaceId] as const
};

/** The workspace's applications with their ordered dashboards; drives the app switcher and rail. */
export const workspaceApplicationsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: applicationKeys.list(workspaceId),
    queryFn: () => orpcClient.workspaceApplications.list({ params: { workspace: workspaceId } }),
    enabled: enabled && workspaceId !== ''
  });

export const invalidateApplicationQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: applicationKeys.list(workspaceId) });
