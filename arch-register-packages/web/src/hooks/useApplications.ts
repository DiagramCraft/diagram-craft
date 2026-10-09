import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateApplicationRequest } from '@arch-register/api-types/applicationContract';
import { invalidateApplicationQueries, workspaceApplicationsQuery } from '../queries/application';
import { orpcClient } from '../lib/orpcClient';

export const useApplications = (workspaceSlug: string, enabled = true) =>
  useQuery(workspaceApplicationsQuery(workspaceSlug, enabled));

/**
 * Route target of the dashboard named `dashboardName` in application `applicationKey`, for widgets
 * that link to a sibling dashboard. `undefined` while applications load or when it does not exist.
 */
export const useApplicationDashboardTarget = (
  workspaceSlug: string,
  applicationKey: string,
  dashboardName: string
) => {
  const { data: applications } = useApplications(workspaceSlug);
  const dashboard = applications
    ?.find(application => application.key === applicationKey)
    ?.dashboards.find(candidate => candidate.name === dashboardName);
  return dashboard
    ? {
        to: '/$workspaceSlug/apps/$appKey/$dashboardId',
        params: { workspaceSlug, appKey: applicationKey, dashboardId: dashboard.id }
      }
    : undefined;
};

export const useUpdateApplication = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateApplicationRequest }) =>
      orpcClient.workspaceApplications.update({ params: { workspace: workspaceSlug, id }, body }),
    onSuccess: () => invalidateApplicationQueries(queryClient, workspaceSlug)
  });
};

export const useDeleteApplication = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.workspaceApplications.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidateApplicationQueries(queryClient, workspaceSlug)
  });
};

export const useReorderApplicationDashboards = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ids }: { applicationId: string; ids: string[] }) =>
      orpcClient.workspaceApplications.reorderDashboards({
        params: { workspace: workspaceSlug, id: applicationId },
        body: { ids }
      }),
    onSuccess: () => invalidateApplicationQueries(queryClient, workspaceSlug)
  });
};
