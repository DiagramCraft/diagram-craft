import { RiskCompliancePlaceholderScreen } from './RiskCompliancePlaceholderScreen';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';

export const RiskComplianceControlsScreen = () => (
  <RiskCompliancePlaceholderScreen
    title="Controls"
    resolver={resolveRiskComplianceConfig}
    notEnabledMessage="Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace settings."
  />
);
