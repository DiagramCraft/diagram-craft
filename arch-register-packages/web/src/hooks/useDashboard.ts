import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateDashboardRequest,
  UpdateDashboardRequest
} from '@arch-register/api-types/dashboardContract';
import { dashboardKeys, invalidateDashboardQueries } from '../queries/dashboard';
import { orpcClient } from '../lib/orpcClient';

export const useWorkspaceDashboards = (workspaceSlug: string) =>
  useQuery({
    queryKey: dashboardKeys.list(workspaceSlug),
    queryFn: () => orpcClient.dashboards.list({ params: { workspace: workspaceSlug } }),
    enabled: workspaceSlug !== ''
  });

export const useCreateWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateDashboardRequest) =>
      orpcClient.dashboards.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useUpdateWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDashboardRequest }) =>
      orpcClient.dashboards.update({ params: { workspace: workspaceSlug, id }, body }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};

export const useDeleteWorkspaceDashboard = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.dashboards.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidateDashboardQueries(queryClient, workspaceSlug)
  });
};
