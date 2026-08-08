import { httpAssert } from '../../utils/httpAssert';
import {
  documentStatusExtensionSchema,
  governanceWorkflowConfigSchema,
  type GovernanceWorkflowConfig
} from '@arch-register/api-types/governanceCaseConfigSchemas';

export type GovernanceWorkflowConfigRowLike = {
  case_subkind: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type ResolvedGovernanceWorkflowConfig = {
  enabled: boolean;
  config: GovernanceWorkflowConfig;
  source: 'default' | 'workspace' | 'subkind';
};

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
    strategy: approval.approverFieldId ? 'document-field' : undefined,
    strategyConfig: approval.approverFieldId ? { fieldId: approval.approverFieldId } : {},
    fallbackUserIds: approval.fallbackUserIds ?? [],
    fallbackTeamIds: approval.fallbackTeamIds ?? []
  };
};

const normalizeCanonicalStrategies = (
  config: GovernanceWorkflowConfig,
  raw: Record<string, unknown>
): GovernanceWorkflowConfig => {
  const rawApprovals = raw['approvals'];
  const rawEscalation = raw['escalation'];
  const approvals = config.approvals
    ? {
        ...config.approvals,
        strategy:
          config.approvals.strategy ??
          (rawApprovals &&
          typeof rawApprovals === 'object' &&
          typeof (rawApprovals as { approverSource?: unknown }).approverSource === 'string'
            ? 'document-field'
            : undefined),
        strategyConfig:
          Object.keys(config.approvals.strategyConfig).length > 0
            ? config.approvals.strategyConfig
            : rawApprovals &&
                typeof rawApprovals === 'object' &&
                typeof (rawApprovals as { approverSource?: unknown }).approverSource === 'string'
              ? { fieldId: (rawApprovals as { approverSource: string }).approverSource }
              : {}
      }
    : undefined;
  const escalation = config.escalation
    ? {
        ...config.escalation,
        strategy:
          config.escalation.strategy ??
          (rawEscalation &&
          typeof rawEscalation === 'object' &&
          typeof (rawEscalation as { strategy?: unknown }).strategy === 'string'
            ? (rawEscalation as { strategy: string }).strategy
            : undefined),
        strategyConfig: config.escalation.strategyConfig
      }
    : undefined;
  return { ...config, approvals, escalation };
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
    if (canonical.success) return normalizeCanonicalStrategies(canonical.data, raw);
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

const mergeGovernanceWorkflowConfig = (
  base: GovernanceWorkflowConfig,
  override: GovernanceWorkflowConfig
): GovernanceWorkflowConfig => ({
  approvals: override.approvals
    ? {
        ...base.approvals,
        ...override.approvals,
        strategy: override.approvals.strategy ?? base.approvals?.strategy,
        strategyConfig: {
          ...(base.approvals?.strategyConfig ?? {}),
          ...override.approvals.strategyConfig
        }
      }
    : base.approvals,
  reminders: override.reminders ?? base.reminders,
  escalation: override.escalation
    ? {
        ...base.escalation,
        ...override.escalation,
        strategy: override.escalation.strategy ?? base.escalation?.strategy,
        strategyConfig: {
          ...(base.escalation?.strategyConfig ?? {}),
          ...override.escalation.strategyConfig
        }
      }
    : base.escalation,
  extensions: { ...base.extensions, ...override.extensions }
});

/**
 * Resolves a case's configuration from the canonical store. A subkind row overrides the
 * workspace-wide row, while unspecified components inherit from the wider scope and then the
 * registered code defaults. This keeps an approval-only row from accidentally erasing reminder
 * defaults and gives every case kind the same precedence rules.
 */
export const resolveGovernanceWorkflowConfig = (
  rows: GovernanceWorkflowConfigRowLike[],
  caseSubkind: string | null,
  defaultConfig: GovernanceWorkflowConfig,
  supportsWorkspaceScope = true
): ResolvedGovernanceWorkflowConfig => {
  const workspaceRow = supportsWorkspaceScope
    ? rows.find(row => row.case_subkind == null)
    : undefined;
  const subkindRow =
    caseSubkind == null ? undefined : rows.find(row => row.case_subkind === caseSubkind);
  const sources = [workspaceRow, subkindRow].filter(
    (row): row is GovernanceWorkflowConfigRowLike => row != null
  );

  let config = governanceWorkflowConfigSchema.parse(defaultConfig);
  for (const row of sources) {
    config = mergeGovernanceWorkflowConfig(
      config,
      parseGovernanceWorkflowConfig(row.config, row.enabled)
    );
  }

  return {
    enabled: subkindRow?.enabled ?? workspaceRow?.enabled ?? true,
    config,
    source: subkindRow ? 'subkind' : workspaceRow ? 'workspace' : 'default'
  };
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
