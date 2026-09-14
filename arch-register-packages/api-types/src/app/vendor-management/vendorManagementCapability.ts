import type { WorkspaceCapabilityDefinition } from '../../integrationCatalog';

/**
 * Vendor Management's workspace capability definition, spread into `workspaceCapabilityDefinitions`
 * by `../../integrationCatalog.ts`. Mirrors `../business-glossary/glossaryCapability.ts`; unlike
 * Business Glossary, no `fieldRoles` are declared yet — the scaffold (#3257) only needs the
 * schema-binding roles the app's placeholder sections gate on, per `strategy-model`'s minimal
 * bindingRoles shape.
 */
export const vendorManagementCapabilityDefinition: WorkspaceCapabilityDefinition = {
  type: 'vendor-management',
  label: 'Vendor Management',
  description: 'Vendor register, contracts and renewals, spend, and vendor risk.',
  features: ['renewals', 'spend-rollups', 'risk'],
  bindingRoles: [
    {
      id: 'vendor',
      label: 'Vendor entity schema',
      description: 'The entity schema used for vendor records.',
      required: true,
      targetKind: 'entity_schema',
      fieldRoles: []
    },
    {
      id: 'contract',
      label: 'Contract entity schema',
      description: 'The entity schema used for vendor contracts.',
      required: false,
      targetKind: 'entity_schema',
      fieldRoles: []
    }
  ]
};
