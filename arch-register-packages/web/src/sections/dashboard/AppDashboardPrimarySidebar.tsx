import { useWorkspaceDashboard } from '../../hooks/useDashboard';
import { DashboardSidebar } from './DashboardSidebar';

/**
 * Renders an app dashboard's optional sidebar (#3467) through the shell's regular
 * `AppRailSection.primarySidebar` slot — the same fixed side panel every other app section uses
 * (`WorkspaceLayout.tsx`), rather than a column drawn inside the dashboard's own scrollable body.
 * `AppDashboardScreen` fetches the same dashboard (deduped by React Query) to derive the sidebar's
 * selection variables for widget config substitution; this component only renders the picker UI.
 */
export const AppDashboardPrimarySidebar = ({
  workspaceSlug,
  dashboardId
}: {
  workspaceSlug: string;
  dashboardId: string;
}) => {
  const { data: dashboard } = useWorkspaceDashboard(workspaceSlug, dashboardId);
  if (!dashboard?.sidebar) return null;

  return (
    <DashboardSidebar
      workspaceSlug={workspaceSlug}
      sidebar={dashboard.sidebar}
      title={dashboard.name}
    />
  );
};
