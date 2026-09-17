import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

const DATA_STEWARDSHIP_CAPABILITY = 'data-stewardship';

export type DataStewardshipConfig = {
  dataEntitySchemaId: string;
};

/**
 * Resolve the workspace's `data-stewardship` capability configuration into the entity-schema ids
 * the app's sections need. There is no bespoke server endpoint for this capability (unlike
 * Business Glossary's `glossary.config`) — the configuration is generic and resolved client-side,
 * mirroring `resolveVendorManagementConfig` in `../vendor-management/vendorManagementQueries.ts`.
 *
 * Only the `dataEntity` binding is resolved here — the Change cases & exceptions section reads
 * existing `entity.change-case` governance cases directly rather than through a bound schema (see
 * `../../../api-types/src/app/data-stewardship/dataStewardshipCapability.ts`).
 */
export const resolveDataStewardshipConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): DataStewardshipConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === DATA_STEWARDSHIP_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const binding = configuration.bindings['dataEntity'];
  const dataEntitySchemaId =
    binding?.target.kind === 'entity_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  if (!dataEntitySchemaId) return null;

  return { dataEntitySchemaId };
};

/**
 * Whether the configured Data Entity schema actually has its `entity.change-case` approval
 * workflow enabled (`entity_approval_policy === 'required'` — the same field
 * `useEntityBrowserSelection.ts`/`EntityDetailScreen.tsx` check before offering "Propose a
 * change"). Without it, no `entity.change-case` governance cases are ever created for the schema,
 * so the Change cases & exceptions section's rail icon is hidden rather than shown as an always-empty
 * register (`WorkspaceLayout.tsx`'s `visibleRailItems`).
 */
export const isChangeCasesWorkflowEnabled = (
  schemas: readonly Pick<EntitySchema, 'id' | 'entity_approval_policy'>[] | undefined,
  config: DataStewardshipConfig | null
): boolean => {
  if (!config) return false;
  const schema = schemas?.find(candidate => candidate.id === config.dataEntitySchemaId);
  return (schema?.entity_approval_policy ?? 'disabled') === 'required';
};
