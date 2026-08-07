import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const governanceWorkflowOverviewKeys = {
  all: ['governance-workflow-overview'] as const,
  detail: (ws: string) => [...governanceWorkflowOverviewKeys.all, ws] as const
};

export const useGovernanceWorkflowOverview = (workspaceSlug: string, enabled = true) => {
  return useQuery({
    queryKey: governanceWorkflowOverviewKeys.detail(workspaceSlug),
    queryFn: () =>
      orpcClient.governanceWorkflowOverview.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    staleTime: 60_000
  });
};
