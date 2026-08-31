import type { DatabaseAdapter } from '../../db/database';
import { encodeCaseSubkind } from './governanceCaseSubkind';

export const ENTITY_CHANGE_POLICY_CASE_KIND = 'entity.change-case';
export const ENTITY_DEPRECATION_POLICY_CASE_KIND = 'entity.deprecation';
export const ENTITY_OWNER_ADMIN_STRATEGY = 'entity-owner-admin';

export type SchemaGovernancePolicies = {
  entity_approval_policy: 'required' | 'disabled';
  deprecation_policy: 'required' | 'disabled';
};

export const schemaWorkflowConfig = {
  supportsSubkind: true,
  supportsApprovals: true,
  supportsReminders: true,
  supportsEscalation: true,
  approvalStrategies: [
    { id: ENTITY_OWNER_ADMIN_STRATEGY, label: 'Entity owner admins', configType: 'none' as const }
  ],
  escalationStrategies: [
    { id: ENTITY_OWNER_ADMIN_STRATEGY, label: 'Entity owner admins', configType: 'none' as const }
  ],
  defaultConfig: {
    approvals: {
      requiredApprovals: 1,
      strategy: ENTITY_OWNER_ADMIN_STRATEGY,
      strategyConfig: {},
      fallbackUserIds: [],
      fallbackTeamIds: []
    },
    escalation: {
      enabled: true,
      overdueDays: 5,
      strategy: ENTITY_OWNER_ADMIN_STRATEGY,
      strategyConfig: {},
      fallbackUserIds: [],
      fallbackTeamIds: []
    },
    extensions: {}
  },
  validateSubkind: async (db: DatabaseAdapter, workspace: string, subkind: string | null) => {
    if (!subkind) return 'Schema-scoped workflows require a schema id';
    return (await db.catalog.getSchema(workspace, subkind))
      ? null
      : `Schema '${subkind}' not found`;
  },
  labelSubkind: async (db: DatabaseAdapter, workspace: string, subkind: string | null) => {
    if (!subkind) return null;
    return (await db.catalog.getSchema(workspace, subkind))?.name ?? subkind;
  }
};

const policyFromRow = (row: { enabled: boolean } | null | undefined) =>
  row?.enabled ? ('required' as const) : ('disabled' as const);

export const getSchemaGovernancePolicies = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string
): Promise<SchemaGovernancePolicies> => {
  if (!db.governanceCaseConfig) {
    return { entity_approval_policy: 'disabled', deprecation_policy: 'disabled' };
  }
  const [entityChange, deprecation] = await Promise.all([
    db.governanceCaseConfig.getCaseConfig(
      workspace,
      ENTITY_CHANGE_POLICY_CASE_KIND,
      encodeCaseSubkind(schemaId)
    ),
    db.governanceCaseConfig.getCaseConfig(
      workspace,
      ENTITY_DEPRECATION_POLICY_CASE_KIND,
      encodeCaseSubkind(schemaId)
    )
  ]);

  return {
    entity_approval_policy: policyFromRow(entityChange),
    deprecation_policy: policyFromRow(deprecation)
  };
};

export const getSchemaGovernancePoliciesBySchema = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<Map<string, SchemaGovernancePolicies>> => {
  if (!db.governanceCaseConfig) return new Map();
  const rows = await db.governanceCaseConfig.listCaseConfig(workspace);
  const policies = new Map<string, SchemaGovernancePolicies>();

  for (const row of rows) {
    if (row.case_subkind == null) continue;
    if (
      row.case_kind !== ENTITY_CHANGE_POLICY_CASE_KIND &&
      row.case_kind !== ENTITY_DEPRECATION_POLICY_CASE_KIND
    )
      continue;

    const schemaId = row.case_subkind;
    const current = policies.get(schemaId) ?? {
      entity_approval_policy: 'disabled' as const,
      deprecation_policy: 'disabled' as const
    };
    if (row.case_kind === ENTITY_CHANGE_POLICY_CASE_KIND) {
      current.entity_approval_policy = policyFromRow(row);
    } else {
      current.deprecation_policy = policyFromRow(row);
    }
    policies.set(schemaId, current);
  }

  return policies;
};

export const upsertSchemaGovernancePolicies = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  policies: SchemaGovernancePolicies,
  updatedAt: Date,
  updatedBy: string | null
) => {
  if (!db.governanceCaseConfig) return;
  const [entityChange, deprecation] = await Promise.all([
    db.governanceCaseConfig.getCaseConfig(
      workspace,
      ENTITY_CHANGE_POLICY_CASE_KIND,
      encodeCaseSubkind(schemaId)
    ),
    db.governanceCaseConfig.getCaseConfig(
      workspace,
      ENTITY_DEPRECATION_POLICY_CASE_KIND,
      encodeCaseSubkind(schemaId)
    )
  ]);
  await Promise.all([
    db.governanceCaseConfig.upsertCaseConfig({
      workspace,
      case_kind: ENTITY_CHANGE_POLICY_CASE_KIND,
      case_subkind: encodeCaseSubkind(schemaId),
      name: entityChange?.name ?? 'Entity change policy',
      description: entityChange?.description,
      enabled: policies.entity_approval_policy === 'required',
      config: {},
      updated_at: updatedAt,
      updated_by: updatedBy
    }),
    db.governanceCaseConfig.upsertCaseConfig({
      workspace,
      case_kind: ENTITY_DEPRECATION_POLICY_CASE_KIND,
      case_subkind: encodeCaseSubkind(schemaId),
      name: deprecation?.name ?? 'Entity deprecation policy',
      description: deprecation?.description,
      enabled: policies.deprecation_policy === 'required',
      config: {},
      updated_at: updatedAt,
      updated_by: updatedBy
    })
  ]);
};

export const getSchemaPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  caseKind: string
) => {
  if (!db.governanceCaseConfig) return false;
  const row = await db.governanceCaseConfig.getCaseConfig(
    workspace,
    caseKind,
    encodeCaseSubkind(schemaId)
  );
  return row?.enabled === true;
};
