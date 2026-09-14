import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';

const VENDOR_MANAGEMENT_CAPABILITY = 'vendor-management';

export type VendorManagementConfig = {
  vendorSchemaId: string;
  /** Optional per the capability's `contract` binding role — `null` when unbound. */
  contractSchemaId: string | null;
  /** Optional per the capability's `technologyRelease` binding role — `null` when unbound. Drives
   *  the Risk section's technology EOL exposure table (`useVendorTechnologyExposure.ts`); every
   *  other section ignores it. */
  technologyReleaseSchemaId: string | null;
};

/**
 * Resolve the workspace's `vendor-management` capability configuration into the entity-schema ids
 * the app's sections need. There is no bespoke server endpoint for this capability (unlike
 * Business Glossary's `glossary.config`) — the configuration is generic and resolved client-side,
 * mirroring `resolveStrategyModelConfig` in `../strategy-model/strategyQueries.ts`.
 */
export const resolveVendorManagementConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): VendorManagementConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === VENDOR_MANAGEMENT_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const schemaId = (role: string): string | null => {
    const binding = configuration.bindings[role];
    return binding?.target.kind === 'entity_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  };

  const vendorSchemaId = schemaId('vendor');
  if (!vendorSchemaId) return null;

  return {
    vendorSchemaId,
    contractSchemaId: schemaId('contract'),
    technologyReleaseSchemaId: schemaId('technologyRelease')
  };
};
