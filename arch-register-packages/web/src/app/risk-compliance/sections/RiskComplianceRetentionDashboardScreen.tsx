import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { riskComplianceAppDefinition } from '../riskComplianceShell';
import { RISK_RETENTION_ID } from '../riskComplianceSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `riskComplianceShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = riskComplianceAppDefinition.sections.find(
    section => section.id === RISK_RETENTION_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Risk & Compliance Retention section has no dashboard.appKey');
  return appKey;
};

export const RiskComplianceRetentionDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
