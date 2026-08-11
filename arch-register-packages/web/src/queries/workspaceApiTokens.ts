import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { WorkspaceApiTokenCreate } from '@arch-register/api-types/apiTokenContract';
import { orpcClient } from '../lib/orpcClient';

export const workspaceApiTokenKeys = {
  all: ['workspace-api-tokens'] as const,
  list: (workspaceId: string) => [...workspaceApiTokenKeys.all, workspaceId] as const
};

export const workspaceApiTokensQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: workspaceApiTokenKeys.list(workspaceId),
    queryFn: () => orpcClient.config.tokens.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 30 * 1000
  });

export const invalidateWorkspaceApiTokens = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: workspaceApiTokenKeys.list(workspaceId) });

export type WorkspaceApiTokenMutation = WorkspaceApiTokenCreate;
