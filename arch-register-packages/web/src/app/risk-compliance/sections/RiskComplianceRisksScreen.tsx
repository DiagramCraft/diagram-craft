import { RiskCompliancePlaceholderScreen } from './RiskCompliancePlaceholderScreen';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';

export const RiskComplianceRisksScreen = () => (
  <RiskCompliancePlaceholderScreen
    title="Risks"
    resolver={resolveRiskComplianceConfig}
    notEnabledMessage="Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace settings."
  />
);
