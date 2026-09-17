import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';

const API_SPECIFICATION_CAPABILITY = 'api-specification';

export type ApiIntegrationCatalogConfig = {
  apiSchemaId: string;
};

/**
 * Resolve the workspace's existing `api-specification` capability configuration (#2826) into the
 * entity-schema id the app's sections need. There is no bespoke server endpoint for this
 * capability — the configuration is generic and resolved client-side, mirroring
 * `resolveVendorManagementConfig` in `../vendor-management/vendorManagementQueries.ts`.
 */
export const resolveApiIntegrationCatalogConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): ApiIntegrationCatalogConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === API_SPECIFICATION_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const binding = configuration.bindings['api'];
  const apiSchemaId =
    binding?.target.kind === 'entity_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  if (!apiSchemaId) return null;

  return { apiSchemaId };
};
