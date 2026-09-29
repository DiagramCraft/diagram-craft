import type { ReactNode } from 'react';
import { AppDashboardScreen } from './AppDashboardScreen';
import styles from './AppDashboardSectionScreen.module.css';

/**
 * Generic rendering shell for a dashboard-backed `AppRailSection` (`shell/shellTypes.ts`):
 * loading placeholder / "not enabled" placeholder / the dashboard itself. Each app keeps its own
 * capability-config resolution (e.g. `resolveApiIntegrationCatalogConfig`) and just passes the
 * resulting `isLoading`/`isEnabled` in — this only collapses the three-way render fork that was
 * duplicated per dashboard section screen (#3469).
 */
export const AppDashboardSectionScreen = (props: {
  appKey: string;
  isLoading: boolean;
  isEnabled: boolean;
  loadingMessage: ReactNode;
  notEnabledMessage: ReactNode;
}) => {
  if (props.isLoading) {
    return <div className={styles.empty}>{props.loadingMessage}</div>;
  }
  if (!props.isEnabled) {
    return <div className={styles.empty}>{props.notEnabledMessage}</div>;
  }
  return <AppDashboardScreen appKey={props.appKey} />;
};
