import type { WorkspaceCapabilityDefinition } from '../../integrationCatalog';

/**
 * Data Stewardship's workspace capability definition, spread into `workspaceCapabilityDefinitions`
 * by `../../integrationCatalog.ts`. Mirrors `../risk-compliance/riskComplianceCapability.ts`; only
 * the scaffold's schema-binding roles are declared here — no `fieldRoles` yet, per
 * `vendor-management`'s own minimal scaffold shape (#3278).
 *
 * A self-contained `data-stewardship` capability type, not a shared `information-governance` one:
 * every existing app defines its own 1:1 capability type, and #3062 (an information-governance
 * vocabularies capability) is not implemented anywhere yet — see #3297.
 *
 * Only one binding role: the Change cases & exceptions section reuses the existing
 * `entity.change-case` governance-case kind directly (per #3152) — Change Case is a built-in
 * governance-case type (`ChangeCaseDatabase`), not a workspace-defined entity schema, so unlike
 * `risk-compliance`'s optional `control`/`framework`/etc. roles there is no second schema to bind
 * here. The exception/waiver register is genuinely new domain model (#3152 calls it out as the one
 * piece #3067 deferred) and isn't designed yet, so it has no binding role either — out of scope
 * for this scaffold (#3297).
 */
export const dataStewardshipCapabilityDefinition: WorkspaceCapabilityDefinition = {
  type: 'data-stewardship',
  label: 'Data Stewardship',
  description: 'Data ownership, classification, and lifecycle change management for datasets.',
  features: ['review-queue', 'classification', 'change-cases'],
  bindingRoles: [
    {
      id: 'dataEntity',
      label: 'Data Entity schema',
      description:
        'The entity schema used for datasets — the existing information-asset entities ' +
        "(#3064/#3065). Typically the `information-governance` template's own Data Entity schema.",
      required: true,
      targetKind: 'entity_schema',
      fieldRoles: []
    }
  ]
};
