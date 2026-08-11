import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const workspaceAnalyticsKeys = {
  all: ['workspace-analytics'] as const,
  workspace: (workspaceId: string) => [...workspaceAnalyticsKeys.all, workspaceId] as const,
  detail: (workspaceId: string, staleAfterDays: number) =>
    [...workspaceAnalyticsKeys.workspace(workspaceId), staleAfterDays] as const
};

export const workspaceAnalyticsQuery = (
  workspaceId: string,
  staleAfterDays: number,
  enabled = true
) =>
  queryOptions({
    queryKey: workspaceAnalyticsKeys.detail(workspaceId, staleAfterDays),
    queryFn: () =>
      orpcClient.analytics.get({
        params: { workspace: workspaceId },
        query: { staleAfterDays }
      }),
    enabled: enabled && workspaceId !== '',
    staleTime: 5 * 60 * 1000
  });
