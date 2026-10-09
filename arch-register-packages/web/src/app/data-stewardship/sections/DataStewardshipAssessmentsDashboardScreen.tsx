import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { DS_ASSESSMENTS_ID } from '../dataStewardshipSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `dataStewardshipShell.tsx`) is the source of
 * truth this screen renders (as in `DataStewardshipDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = dataStewardshipAppDefinition.sections.find(
    section => section.id === DS_ASSESSMENTS_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Data Stewardship Assessments section has no dashboard.appKey');
  return appKey;
};

/**
 * The Data Stewardship Assessments section: a configurable dashboard (#3505) of assessment status
 * tiles and a progress table, scoped to the assessments that target the Data Entity schema.
 */
export const DataStewardshipAssessmentsDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
