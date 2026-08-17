import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateAuditQueries } from './audit';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => workspaceKeys.lists(),
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (workspaceId: string) => [...workspaceKeys.details(), workspaceId] as const,
  templates: () => [...workspaceKeys.all, 'templates'] as const
};

export const workspacesQuery = () =>
  queryOptions({
    queryKey: workspaceKeys.list(),
    queryFn: () => orpcClient.workspaces.list({}),
    staleTime: 5 * 60 * 1000
  });

export const workspaceTemplateCatalogQuery = () =>
  queryOptions({
    queryKey: workspaceKeys.templates(),
    queryFn: () => orpcClient.workspaces.templates(undefined),
    staleTime: 30 * 60 * 1000
  });

export const setWorkspaceDetailCache = (
  queryClient: QueryClient,
  workspaceId: string,
  value: unknown
) => queryClient.setQueryData(workspaceKeys.detail(workspaceId), value);

export const invalidateWorkspaceList = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });

export const invalidateWorkspaceAfterUpdate = async (
  queryClient: QueryClient,
  workspaceId: string,
  updatedSlug?: string
) => {
  await Promise.all([
    invalidateWorkspaceList(queryClient),
    invalidateAuditQueries(queryClient, workspaceId),
    ...(updatedSlug && updatedSlug !== workspaceId
      ? [invalidateAuditQueries(queryClient, updatedSlug)]
      : [])
  ]);
};

export const removeDeletedWorkspace = async (queryClient: QueryClient, workspaceId: string) => {
  await invalidateWorkspaceList(queryClient);
  queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
};
