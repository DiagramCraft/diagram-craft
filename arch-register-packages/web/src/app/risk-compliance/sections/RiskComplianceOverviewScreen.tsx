import { RiskCompliancePlaceholderScreen } from './RiskCompliancePlaceholderScreen';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';

export const RiskComplianceOverviewScreen = () => (
  <RiskCompliancePlaceholderScreen
    title="Overview"
    resolver={resolveRiskComplianceConfig}
    notEnabledMessage="Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace settings."
  />
);
