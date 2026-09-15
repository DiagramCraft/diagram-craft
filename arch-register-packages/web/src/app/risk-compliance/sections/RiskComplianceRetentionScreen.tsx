import { RiskCompliancePlaceholderScreen } from './RiskCompliancePlaceholderScreen';
import { resolveRetentionConfig } from '../riskComplianceQueries';

export const RiskComplianceRetentionScreen = () => (
  <RiskCompliancePlaceholderScreen
    title="Retention"
    resolver={resolveRetentionConfig}
    notEnabledMessage="Retention is not configured. Configure the retention capability in workspace settings."
  />
);
