import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';

export const documentStatusExtension = (config: GovernanceWorkflowConfig) => {
  const extension = config.extensions['document.status'];
  if (!extension || typeof extension !== 'object') return { statusesRequiringApprovals: [] };
  const values = (extension as { statusesRequiringApprovals?: unknown }).statusesRequiringApprovals;
  return {
    statusesRequiringApprovals: Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : []
  };
};

export const defaultWorkflowConfig = (
  caseKind: GovernanceWorkflowCaseKind
): GovernanceWorkflowConfig => caseKind.defaultConfig;

export const parseDays = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= 0);

export type StrategySection =
  | NonNullable<GovernanceWorkflowConfig['approvals']>
  | NonNullable<GovernanceWorkflowConfig['escalation']>;
