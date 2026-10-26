import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProjectDashboardRequest } from '@arch-register/api-types/dashboardContract';
import {
  invalidateProjectDashboardQueries,
  projectDashboardQuery
} from '../queries/projectDashboard';
import { orpcClient } from '../lib/orpcClient';

export const useProjectDashboard = (workspaceId: string, projectId: string) =>
  useQuery(projectDashboardQuery(workspaceId, projectId));

export const useUpdateProjectDashboard = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProjectDashboardRequest) =>
      orpcClient.projectDashboard.update({ params: { workspace: workspaceId, projectId }, body }),
    onSuccess: () => invalidateProjectDashboardQueries(queryClient, workspaceId, projectId)
  });
};
