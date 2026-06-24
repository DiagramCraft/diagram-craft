import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from './queryKeys';

export const useWorkspaceAnalytics = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: workspaceAnalyticsKeys.detail(workspaceSlug),
    queryFn: () => orpcClient.analytics.get({ params: { workspace: workspaceSlug } }),
    enabled: enabled && workspaceSlug !== '',
    staleTime: 5 * 60 * 1000
  });
