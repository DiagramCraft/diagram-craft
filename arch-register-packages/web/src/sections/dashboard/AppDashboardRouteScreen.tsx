import { useParams } from '@tanstack/react-router';
import { AppDashboardScreen } from './AppDashboardScreen';
import { useApplications } from '../../hooks/useApplications';
import { findDashboardByKeyOrId } from '../../lib/applicationDashboards';

/**
 * Generic screen of the `apps/$appKey/$dashboardKey` route: renders the dashboard in the URL.
 * Entity and governance-case drawers opened by widgets live in the workspace drawer stack.
 */
export const AppDashboardRouteScreen = () => {
  const { workspaceSlug, appKey, dashboardKey } = useParams({ strict: false }) as {
    workspaceSlug: string;
    appKey: string;
    dashboardKey: string;
  };
  const { data: applications } = useApplications(workspaceSlug);
  const dashboard = findDashboardByKeyOrId(
    applications?.find(application => application.key === appKey)?.dashboards,
    dashboardKey
  );

  return dashboard ? <AppDashboardScreen dashboardId={dashboard.id} /> : null;
};
