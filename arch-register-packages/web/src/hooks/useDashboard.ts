import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PutDashboardRequest } from '@arch-register/api-types/dashboardContract';
import { dashboardKeys, invalidateDashboardQueries } from '../queries/dashboard';
import { orpcClient } from '../lib/orpcClient';

export const useWorkspaceDashboard = (workspaceSlug: string) =>
  useQuery({
    queryKey: dashboardKeys.workspace(workspaceSlug),
    queryFn: () => orpcClient.dashboard.get({ params: { workspace: workspaceSlug } }),
    enabled: workspaceSlug !== ''
  });

export const useUpdateWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PutDashboardRequest) =>
      orpcClient.dashboard.put({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};
