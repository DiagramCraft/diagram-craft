import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { riskComplianceAppDefinition } from '../riskComplianceShell';
import { RISK_OVERVIEW_ID } from '../riskComplianceSections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `riskComplianceShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = riskComplianceAppDefinition.sections.find(
    section => section.id === RISK_OVERVIEW_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Risk & Compliance Overview section has no dashboard.appKey');
  return appKey;
};

export const RiskComplianceOverviewDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
