import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
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
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const isEnabled = resolveDataStewardshipConfig(configurations.data) != null;

  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={isEnabled}
      loadingMessage="Loading data stewardship…"
      notEnabledMessage="Data stewardship is not enabled. Configure the data stewardship capability in workspace settings."
    />
  );
};
