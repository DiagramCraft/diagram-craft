import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { DS_CHANGE_CASES_ID } from '../dataStewardshipSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `dataStewardshipShell.tsx`) is the source of
 * truth this screen renders (as in `DataStewardshipDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = dataStewardshipAppDefinition.sections.find(
    section => section.id === DS_CHANGE_CASES_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Data Stewardship Change cases section has no dashboard.appKey');
  return appKey;
};

/**
 * The Data Stewardship Change cases & exceptions section: a configurable dashboard (#3504) around
 * the generic change case table widget, scoped to Data Entity change proposals.
 */
export const DataStewardshipChangeCasesDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
