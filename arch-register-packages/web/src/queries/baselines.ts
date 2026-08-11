import type { QueryClient } from '@tanstack/react-query';

export const baselineKeys = {
  all: ['baselines'] as const,
  lists: () => [...baselineKeys.all, 'list'] as const,
  list: (workspaceId: string, includeDeleted = false) =>
    [...baselineKeys.lists(), workspaceId, includeDeleted] as const,
  details: () => [...baselineKeys.all, 'detail'] as const,
  detail: (workspaceId: string, id: string) =>
    [...baselineKeys.details(), workspaceId, id] as const
};

export const invalidateBaselineQueries = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [...baselineKeys.lists(), workspaceId] }),
    queryClient.invalidateQueries({ queryKey: [...baselineKeys.details(), workspaceId] })
  ]);
