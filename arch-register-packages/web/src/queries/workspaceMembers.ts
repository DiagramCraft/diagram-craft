import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const workspaceMembersKeys = {
  all: ['workspace-members'] as const,
  list: (workspaceId: string) => [...workspaceMembersKeys.all, workspaceId] as const,
  users: (workspaceId: string, q?: string, limit?: number) =>
    [...workspaceMembersKeys.all, workspaceId, 'users', q ?? '', limit ?? null] as const
};

export const workspaceMembersQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: workspaceMembersKeys.list(workspaceId),
    queryFn: () => orpcClient.config.members.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000
  });

export const workspaceUsersQuery = (
  workspaceId: string,
  options: { q?: string; limit?: number } = {},
  enabled = true
) =>
  queryOptions({
    queryKey: workspaceMembersKeys.users(workspaceId, options.q, options.limit),
    queryFn: () =>
      orpcClient.config.users.list({
        params: { workspace: workspaceId },
        query: { q: options.q, limit: options.limit }
      }),
    enabled: enabled && !!workspaceId,
    staleTime: 2 * 60 * 1000
  });

export const invalidateWorkspaceMembers = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: workspaceMembersKeys.list(workspaceId) });

export const invalidateAllWorkspaceMembers = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: workspaceMembersKeys.all });
