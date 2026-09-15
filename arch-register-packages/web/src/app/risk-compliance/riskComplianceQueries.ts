import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';

const RISK_COMPLIANCE_CAPABILITY = 'risk-compliance';
const RETENTION_CAPABILITY = 'retention';

export type RiskComplianceConfig = {
  riskSchemaId: string;
  /** Optional per the capability's `control` binding role — `null` when unbound. */
  controlSchemaId: string | null;
  /** Optional per the capability's `framework` binding role — `null` when unbound. */
  frameworkSchemaId: string | null;
  /** Optional per the capability's `complianceRequirement` binding role — `null` when unbound. */
  complianceRequirementSchemaId: string | null;
  /** Optional per the capability's `dataEntity` binding role — `null` when unbound. Resolves the
   *  information-asset schema `control-affects` is scoped to at the schema level (Control
   *  Protection only exists when the `information-governance` template's Data Entity schema is
   *  available — see `schemaTemplates.ts`'s `control-protection` composition extension). */
  dataEntitySchemaId: string | null;
};

/**
 * Resolve the workspace's `risk-compliance` capability configuration into the entity-schema ids
 * the app's sections need. There is no bespoke server endpoint for this capability — the
 * configuration is generic and resolved client-side, mirroring `resolveVendorManagementConfig` in
 * `../vendor-management/vendorManagementQueries.ts`.
 */
export const resolveRiskComplianceConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): RiskComplianceConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === RISK_COMPLIANCE_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const schemaId = (role: string): string | null => {
    const binding = configuration.bindings[role];
    return binding?.target.kind === 'entity_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  };

  const riskSchemaId = schemaId('risk');
  if (!riskSchemaId) return null;

  return {
    riskSchemaId,
    controlSchemaId: schemaId('control'),
    frameworkSchemaId: schemaId('framework'),
    complianceRequirementSchemaId: schemaId('complianceRequirement'),
    dataEntitySchemaId: schemaId('dataEntity')
  };
};

export type RetentionConfig = {
  policySchemaId: string;
  assignmentSchemaId: string;
};

/**
 * Resolve the workspace's generic `retention` capability configuration (`policy` entity-schema and
 * `assignment` relation-schema binding roles, both required — see
 * `workspaceCapabilityDefinitions` in `@arch-register/api-types/integrationCatalog`) into the
 * schema ids the Retention rail section gates on. Distinct from `resolveRiskComplianceConfig`:
 * Retention is enabled independently of the rest of the Risk & Compliance app (#3278).
 */
export const resolveRetentionConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): RetentionConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === RETENTION_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const policyBinding = configuration.bindings['policy'];
  const assignmentBinding = configuration.bindings['assignment'];
  const policySchemaId =
    policyBinding?.target.kind === 'entity_schema' && policyBinding.target.id.length > 0
      ? policyBinding.target.id
      : null;
  const assignmentSchemaId =
    assignmentBinding?.target.kind === 'relation_schema' && assignmentBinding.target.id.length > 0
      ? assignmentBinding.target.id
      : null;
  if (!policySchemaId || !assignmentSchemaId) return null;

  return { policySchemaId, assignmentSchemaId };
};
