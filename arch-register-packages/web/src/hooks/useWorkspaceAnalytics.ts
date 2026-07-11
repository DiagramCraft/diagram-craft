import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from './queryKeys';

export const useWorkspaceAnalytics = (
  workspaceSlug: string,
  staleAfterDays: number,
  enabled = true
) =>
  useQuery({
    queryKey: workspaceAnalyticsKeys.detail(workspaceSlug, staleAfterDays),
    queryFn: () =>
      orpcClient.analytics.get({
        params: { workspace: workspaceSlug },
        query: { staleAfterDays }
      }),
    enabled: enabled && workspaceSlug !== '',
    staleTime: 5 * 60 * 1000
  });
