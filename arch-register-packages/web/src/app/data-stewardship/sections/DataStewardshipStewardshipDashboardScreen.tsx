import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { DS_STEWARDSHIP_ID } from '../dataStewardshipSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `dataStewardshipShell.tsx`) is the source of
 * truth this screen renders (as in `DataStewardshipDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = dataStewardshipAppDefinition.sections.find(
    section => section.id === DS_STEWARDSHIP_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Data Stewardship Stewardship section has no dashboard.appKey');
  return appKey;
};

/**
 * The Data Stewardship Stewardship section: a configurable dashboard (#3502) of dataset coverage
 * tiles and the conformance gaps to close, scoped to the Data Entity schema.
 */
export const DataStewardshipStewardshipDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
