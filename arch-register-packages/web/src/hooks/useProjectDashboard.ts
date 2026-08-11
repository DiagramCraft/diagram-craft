import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProjectDashboardRequest } from '@arch-register/api-types/dashboardContract';
import {
  invalidateProjectDashboardQueries,
  projectDashboardQuery
} from '../queries/projectDashboard';
import { orpcClient } from '../lib/orpcClient';

export const useProjectDashboard = (workspaceSlug: string, projectId: string) =>
  useQuery(projectDashboardQuery(workspaceSlug, projectId));

export const useUpdateProjectDashboard = (workspaceSlug: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProjectDashboardRequest) =>
      orpcClient.projectDashboard.update({ params: { workspace: workspaceSlug, projectId }, body }),
    onSuccess: () => invalidateProjectDashboardQueries(queryClient, workspaceSlug, projectId)
  });
};
