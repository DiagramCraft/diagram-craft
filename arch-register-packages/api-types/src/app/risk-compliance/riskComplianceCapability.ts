import type { WorkspaceCapabilityDefinition } from '../../integrationCatalog';

/**
 * Risk & Compliance's workspace capability definition, spread into `workspaceCapabilityDefinitions`
 * by `../../integrationCatalog.ts`. Mirrors `../vendor-management/vendorManagementCapability.ts`;
 * only the scaffold's schema-binding roles are declared here — no `fieldRoles` yet, per
 * `vendor-management`'s own minimal scaffold shape (#3278).
 */
export const riskComplianceCapabilityDefinition: WorkspaceCapabilityDefinition = {
  type: 'risk-compliance',
  label: 'Risk & Compliance',
  description:
    'Risk register, control library, compliance frameworks, and requirement traceability.',
  features: ['risk-register', 'control-library', 'traceability'],
  bindingRoles: [
    {
      id: 'risk',
      label: 'Risk entity schema',
      description: 'The entity schema used for risk records.',
      required: true,
      targetKind: 'entity_schema',
      fieldRoles: []
    },
    {
      id: 'control',
      label: 'Control entity schema',
      description: 'The entity schema used for control records.',
      required: false,
      targetKind: 'entity_schema',
      fieldRoles: []
    },
    {
      id: 'framework',
      label: 'Framework entity schema',
      description: 'The entity schema used for compliance framework records.',
      required: false,
      targetKind: 'entity_schema',
      fieldRoles: []
    },
    {
      id: 'complianceRequirement',
      label: 'Compliance Requirement entity schema',
      description: 'The entity schema used for compliance requirement records.',
      required: false,
      targetKind: 'entity_schema',
      fieldRoles: []
    }
  ]
};
