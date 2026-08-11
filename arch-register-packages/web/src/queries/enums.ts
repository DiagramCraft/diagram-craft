import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const enumKeys = {
  all: ['enums'] as const,
  lists: () => [...enumKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...enumKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => enumKeys.workspaceLists(workspaceId),
  details: () => [...enumKeys.all, 'detail'] as const,
  detail: (workspaceId: string, enumId: string) =>
    [...enumKeys.details(), workspaceId, enumId] as const
};

export const enumsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: enumKeys.list(workspaceId),
    queryFn: () => orpcClient.enums.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const invalidateEnumQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  enumId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceId) }),
    ...(enumId
      ? [queryClient.invalidateQueries({ queryKey: enumKeys.detail(workspaceId, enumId) })]
      : [])
  ]);
};

export const invalidateDeletedEnum = async (
  queryClient: QueryClient,
  workspaceId: string,
  enumId: string
) => {
  await queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: enumKeys.detail(workspaceId, enumId) });
};
