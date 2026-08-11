import { useQuery } from '@tanstack/react-query';
import { workspaceAnalyticsQuery } from '../queries/workspaceAnalytics';

export const useWorkspaceAnalytics = (
  workspaceSlug: string,
  staleAfterDays: number,
  enabled = true
) => useQuery(workspaceAnalyticsQuery(workspaceSlug, staleAfterDays, enabled));
