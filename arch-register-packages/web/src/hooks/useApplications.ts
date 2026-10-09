import { useQuery } from '@tanstack/react-query';
import { workspaceApplicationsQuery } from '../queries/application';

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
