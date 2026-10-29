import type { DatabaseAdapter } from '../../db/database';
import { encodeCaseSubkind } from './governanceCaseSubkind';

export const ENTITY_CHANGE_POLICY_CASE_KIND = 'entity.change-case';
export const ENTITY_DEPRECATION_POLICY_CASE_KIND = 'entity.deprecation';
export const RELATION_CHANGE_POLICY_CASE_KIND = 'relation.change-case';
export const ENTITY_OWNER_ADMIN_STRATEGY = 'entity-owner-admin';

export type SchemaGovernancePolicies = {
  entity_approval_policy: 'required' | 'disabled';
  deprecation_policy: 'required' | 'disabled';
};

export const schemaWorkflowConfig = {
  supportsSubkind: true,
  supportsMultiScope: true,
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
    if (
      row.case_kind !== ENTITY_CHANGE_POLICY_CASE_KIND &&
      row.case_kind !== ENTITY_DEPRECATION_POLICY_CASE_KIND
    )
      continue;

    for (const schemaId of row.case_subkinds) {
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
  }

  return policies;
};

/**
 * Sets whether a schema is covered by an enabled workflow of `caseKind`. A schema that is part of a
 * shared (multi-schema) workflow whose `enabled` differs is split out into its own workflow, so the
 * change never affects the other schemas.
 */
const setSchemaScopedPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  caseKind: string,
  schemaId: string,
  enabled: boolean,
  defaultName: string,
  updatedAt: Date,
  updatedBy: string | null
) => {
  if (!db.governanceCaseConfig) return;
  const subkind = encodeCaseSubkind(schemaId);
  const existing = await db.governanceCaseConfig.getCaseConfig(workspace, caseKind, subkind);

  const base = {
    workspace,
    case_kind: caseKind,
    name: existing?.name ?? defaultName,
    description: existing?.description,
    enabled,
    config: existing?.config ?? {},
    updated_at: updatedAt,
    updated_by: updatedBy
  };

  if (!existing) {
    await db.governanceCaseConfig.upsertCaseConfig({ ...base, case_subkinds: [subkind] });
    return;
  }
  if (existing.enabled === enabled) return;
  if (existing.case_subkinds.length === 1) {
    await db.governanceCaseConfig.upsertCaseConfig({
      ...base,
      id: existing.id,
      case_subkinds: existing.case_subkinds
    });
    return;
  }
  // Shared workflow: shrink it first (frees the unique scope slot), then give the schema its own
  await db.governanceCaseConfig.upsertCaseConfig({
    workspace,
    case_kind: caseKind,
    id: existing.id,
    case_subkinds: existing.case_subkinds.filter(other => other !== subkind),
    name: existing.name,
    description: existing.description,
    enabled: existing.enabled,
    config: existing.config,
    updated_at: updatedAt,
    updated_by: updatedBy
  });
  await db.governanceCaseConfig.upsertCaseConfig({ ...base, case_subkinds: [subkind] });
};

export const upsertSchemaGovernancePolicies = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  policies: SchemaGovernancePolicies,
  updatedAt: Date,
  updatedBy: string | null
) => {
  await setSchemaScopedPolicy(
    db,
    workspace,
    ENTITY_CHANGE_POLICY_CASE_KIND,
    schemaId,
    policies.entity_approval_policy === 'required',
    'Entity change policy',
    updatedAt,
    updatedBy
  );
  await setSchemaScopedPolicy(
    db,
    workspace,
    ENTITY_DEPRECATION_POLICY_CASE_KIND,
    schemaId,
    policies.deprecation_policy === 'required',
    'Entity deprecation policy',
    updatedAt,
    updatedBy
  );
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

export const relationSchemaWorkflowConfig = {
  supportsSubkind: true,
  supportsMultiScope: true,
  validateSubkind: async (db: DatabaseAdapter, workspace: string, subkind: string | null) => {
    if (!subkind) return 'Relation-schema-scoped workflows require a relation schema id';
    return (await db.relation.getRelationSchema(workspace, subkind))
      ? null
      : `Relation schema '${subkind}' not found`;
  },
  labelSubkind: async (db: DatabaseAdapter, workspace: string, subkind: string | null) => {
    if (!subkind) return null;
    return (await db.relation.getRelationSchema(workspace, subkind))?.name ?? subkind;
  }
};

export type RelationApprovalPolicy = 'required' | 'disabled';

export const getRelationApprovalPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string
): Promise<RelationApprovalPolicy> =>
  (await getSchemaPolicy(db, workspace, schemaId, RELATION_CHANGE_POLICY_CASE_KIND))
    ? 'required'
    : 'disabled';

export const getRelationApprovalPoliciesBySchema = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<Map<string, RelationApprovalPolicy>> => {
  if (!db.governanceCaseConfig) return new Map();
  const rows = await db.governanceCaseConfig.listCaseConfig(workspace);
  return new Map(
    rows
      .filter(row => row.case_kind === RELATION_CHANGE_POLICY_CASE_KIND)
      .flatMap(row => row.case_subkinds.map(schemaId => [schemaId, policyFromRow(row)] as const))
  );
};

export const upsertRelationApprovalPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  policy: RelationApprovalPolicy,
  updatedAt: Date,
  updatedBy: string | null
) =>
  setSchemaScopedPolicy(
    db,
    workspace,
    RELATION_CHANGE_POLICY_CASE_KIND,
    schemaId,
    policy === 'required',
    'Relation change policy',
    updatedAt,
    updatedBy
  );
