import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { riskComplianceAppDefinition } from '../riskComplianceShell';
import { RISK_ASSESSMENTS_ID } from '../riskComplianceSections';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `riskComplianceShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = riskComplianceAppDefinition.sections.find(
    section => section.id === RISK_ASSESSMENTS_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Risk & Compliance Assessments section has no dashboard.appKey');
  return appKey;
};

export const RiskComplianceAssessmentsDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const isEnabled = resolveRiskComplianceConfig(configurations.data) != null;
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={isEnabled}
      loadingMessage="Loading risk & compliance…"
      notEnabledMessage="Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace settings."
    />
  );
};
