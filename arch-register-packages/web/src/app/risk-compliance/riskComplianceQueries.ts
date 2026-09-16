import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId
} from '@arch-register/api-types/integrationCatalog';

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

export type RetentionFieldIds = {
  durationFieldId: string;
  timeUnitFieldId: string;
  activatedFromFieldId: string;
};

/**
 * Resolves the `retention` capability's `duration`/`timeUnit`/`activatedFrom` semantic field
 * roles into the actual per-workspace field ids they're mapped to. Unlike `risk-compliance`'s
 * fixed field ids (`control_type`, `residual_risk_score`, ...), `retention`'s binding roles carry
 * their own field-role mappings (`workspaceCapabilityDefinitions` in
 * `@arch-register/api-types/integrationCatalog`) — a workspace can map `duration` to any `number`
 * field on its Retention Policy schema, not just one literally named `duration`. Mirrors the
 * server's own `resolveRetentionBindings` in `server/src/domain/catalog/retentionStatus.ts`,
 * resolved client-side so `useRetentionAssignments.ts` can read a policy's duration/time unit and
 * an assignment's activation date to report them as plain facts — see that hook's doc comment for
 * why it deliberately doesn't compute a per-assignment expiry date from them.
 */
export const resolveRetentionFieldIds = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): RetentionFieldIds | null => {
  const definition = getWorkspaceCapabilityDefinition(RETENTION_CAPABILITY);
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === RETENTION_CAPABILITY
  );
  if (!definition || !configuration?.valid) return null;

  const policyBinding = configuration.bindings['policy'];
  const assignmentBinding = configuration.bindings['assignment'];
  if (!policyBinding || !assignmentBinding) return null;

  const policyRole = definition.bindingRoles.find(role => role.id === 'policy');
  const assignmentRole = definition.bindingRoles.find(role => role.id === 'assignment');
  const durationRole = policyRole?.fieldRoles.find(role => role.id === 'duration');
  const timeUnitRole = policyRole?.fieldRoles.find(role => role.id === 'timeUnit');
  const activatedFromRole = assignmentRole?.fieldRoles.find(role => role.id === 'activatedFrom');
  if (!durationRole || !timeUnitRole || !activatedFromRole) return null;

  return {
    durationFieldId: resolveCapabilityFieldId(policyBinding, durationRole),
    timeUnitFieldId: resolveCapabilityFieldId(policyBinding, timeUnitRole),
    activatedFromFieldId: resolveCapabilityFieldId(assignmentBinding, activatedFromRole)
  };
};
