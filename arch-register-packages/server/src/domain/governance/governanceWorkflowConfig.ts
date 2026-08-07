import { httpAssert } from '../../utils/httpAssert';
import {
  documentStatusExtensionSchema,
  governanceWorkflowConfigSchema,
  type GovernanceWorkflowConfig
} from '@arch-register/api-types/governanceCaseConfigSchemas';

const firstLegacyApproval = (statuses: Record<string, unknown>) => {
  const approval = Object.values(statuses).find(
    value =>
      value != null && typeof value === 'object' && (value as { required?: unknown }).required
  ) as
    | {
        requiredApprovals?: number;
        approverFieldId?: string;
        fallbackUserIds?: string[];
        fallbackTeamIds?: string[];
      }
    | undefined;
  if (!approval) return undefined;
  return {
    requiredApprovals: approval.requiredApprovals ?? 1,
    approverSource: approval.approverFieldId,
    fallbackUserIds: approval.fallbackUserIds ?? [],
    fallbackTeamIds: approval.fallbackTeamIds ?? []
  };
};

/** Reads canonical rows and the pre-harmonization rows still present in seeded fixtures. */
export const parseGovernanceWorkflowConfig = (
  raw: Record<string, unknown>,
  rowEnabled = true
): GovernanceWorkflowConfig => {
  const hasLegacyShape =
    raw['statuses'] !== undefined ||
    raw['approaching_days'] !== undefined ||
    raw['overdue_days'] !== undefined ||
    raw['escalation_enabled'] !== undefined;
  if (!hasLegacyShape) {
    const canonical = governanceWorkflowConfigSchema.safeParse(raw);
    if (canonical.success) return canonical.data;
  }

  const reminders =
    Array.isArray(raw['approaching_days']) || Array.isArray(raw['overdue_days'])
      ? {
          enabled: rowEnabled,
          approachingDays: Array.isArray(raw['approaching_days'])
            ? (raw['approaching_days'] as number[])
            : [],
          overdueDays: Array.isArray(raw['overdue_days']) ? (raw['overdue_days'] as number[]) : []
        }
      : undefined;
  const statuses = raw['statuses'];
  const approvals =
    statuses != null && typeof statuses === 'object'
      ? firstLegacyApproval(statuses as Record<string, unknown>)
      : undefined;
  const extension =
    statuses != null && typeof statuses === 'object'
      ? documentStatusExtensionSchema.parse({
          statusesRequiringApprovals: rowEnabled
            ? Object.entries(statuses as Record<string, { required?: boolean }>)
                .filter(([, value]) => value?.required === true)
                .map(([value]) => value)
            : []
        })
      : undefined;

  return governanceWorkflowConfigSchema.parse({
    approvals,
    reminders: reminders
      ? {
          ...reminders,
          approachingDays: reminders.approachingDays.filter(Number.isInteger),
          overdueDays: reminders.overdueDays.filter(Number.isInteger)
        }
      : undefined,
    escalation:
      raw['escalation_enabled'] !== undefined
        ? {
            enabled: raw['escalation_enabled'] !== false,
            overdueDays: 1,
            fallbackUserIds: [],
            fallbackTeamIds: []
          }
        : undefined,
    extensions: extension ? { 'document.status': extension } : {}
  });
};

export const validateDocumentStatusWorkflowConfig = (config: GovernanceWorkflowConfig) => {
  const extension = config.extensions['document.status'];
  if (extension === undefined) return;
  documentStatusExtensionSchema.parse(extension);
  httpAssert.present(config.approvals, {
    status: 400,
    message: 'Document status configuration requires an approval policy'
  });
};
