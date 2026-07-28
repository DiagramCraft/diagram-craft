import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProjectDashboardRequest } from '@arch-register/api-types/dashboardContract';
import {
  projectDashboardKeys,
  invalidateProjectDashboardQueries
} from '../queries/projectDashboard';
import { orpcClient } from '../lib/orpcClient';

export const useProjectDashboard = (workspaceSlug: string, projectId: string) =>
  useQuery({
    queryKey: projectDashboardKeys.detail(workspaceSlug, projectId),
    queryFn: () =>
      orpcClient.projectDashboard.get({ params: { workspace: workspaceSlug, projectId } }),
    enabled: workspaceSlug !== '' && projectId !== ''
  });

export const useUpdateProjectDashboard = (workspaceSlug: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProjectDashboardRequest) =>
      orpcClient.projectDashboard.update({ params: { workspace: workspaceSlug, projectId }, body }),
    onSuccess: () => invalidateProjectDashboardQueries(queryClient, workspaceSlug, projectId)
  });
};
