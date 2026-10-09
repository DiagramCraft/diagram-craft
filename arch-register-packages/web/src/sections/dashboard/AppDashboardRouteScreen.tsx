import type { AppDefinition } from '../../shell/shellTypes';
import { AppDashboardScreen } from './AppDashboardScreen';

/**
 * Generic screen for any `AppRailSection` with `dashboard` set: renders the section's dashboard, so a dashboard-only section needs no bespoke screen (#3493).
 */
export const AppDashboardRouteScreen = (props: { app: AppDefinition; sectionId: string }) => {
  const dashboard = props.app.sections.find(section => section.id === props.sectionId)?.dashboard;
  if (!dashboard?.appKey) {
    throw new Error(`${props.app.name} section ${props.sectionId} has no dashboard.appKey`);
  }
  return <AppDashboardScreen appKey={dashboard.appKey} />;
};
