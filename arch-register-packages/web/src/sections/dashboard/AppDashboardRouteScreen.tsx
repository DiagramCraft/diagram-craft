import { useParams } from '@tanstack/react-router';
import type { AppDefinition } from '../../shell/shellTypes';
import { useAppEnabled } from '../../shell/appCapabilityGate';
import { AppDashboardSectionScreen } from './AppDashboardSectionScreen';

/**
 * Generic screen for any `AppRailSection` with `dashboard` set: resolves the app's capability gate
 * and renders the section's dashboard, so a dashboard-only section needs no bespoke screen (#3493).
 */
export const AppDashboardRouteScreen = (props: { app: AppDefinition; sectionId: string }) => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const { isLoading, isEnabled } = useAppEnabled(props.app, workspaceSlug);
  const dashboard = props.app.sections.find(section => section.id === props.sectionId)?.dashboard;
  if (!dashboard?.appKey) {
    throw new Error(`${props.app.name} section ${props.sectionId} has no dashboard.appKey`);
  }
  return (
    <AppDashboardSectionScreen
      appKey={dashboard.appKey}
      isLoading={isLoading}
      isEnabled={isEnabled}
      loadingMessage={dashboard.loadingMessage ?? 'Loading…'}
      notEnabledMessage={dashboard.notEnabledMessage ?? `${props.app.name} is not enabled.`}
    />
  );
};
