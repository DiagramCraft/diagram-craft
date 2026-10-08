import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { DS_CLASSIFICATION_ID } from '../dataStewardshipSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `dataStewardshipShell.tsx`) is the source of
 * truth this screen renders (as in `DataStewardshipDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = dataStewardshipAppDefinition.sections.find(
    section => section.id === DS_CLASSIFICATION_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Data Stewardship Classification section has no dashboard.appKey');
  return appKey;
};

/**
 * The Data Stewardship Classification section: a configurable dashboard (#3503) of classification
 * stat tiles plus the classified datasets, restricted flows and cross-boundary transfers panels.
 */
export const DataStewardshipClassificationDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
