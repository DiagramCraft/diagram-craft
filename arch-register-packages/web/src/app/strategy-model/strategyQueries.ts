import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';

const STRATEGY_CAPABILITY = 'strategy-model';

export type StrategyModelConfig = {
  objectiveSchemaId: string;
  outcomeSchemaId: string;
  initiativeSchemaId: string;
  measureSchemaId: string;
  businessCapabilitySchemaId: string;
  /** Real, per-workspace relation schema id for `objective-supports-business-capability` — not
   *  the schema template's own `symId` string (see `schemaTemplates.ts`'s `strategy-model`
   *  bindings), which typed-relation queries and metric configs must be keyed by instead. */
  objectiveSupportsBusinessCapabilityRelationSchemaId: string;
  /** Same, for `business-capability-supports-entity`. */
  businessCapabilitySupportsEntityRelationSchemaId: string;
};

/**
 * Resolve the workspace's `strategy-model` capability configuration into the entity-schema and
 * relation-schema ids the app's sections need. There is no bespoke server endpoint for this
 * capability (unlike Business Glossary's `glossary.config`) — the configuration is generic and
 * resolved client-side, mirroring `resolveAffectedObjectiveConfig` in
 * `../../sections/projects/components/affectedObjectives.ts`.
 */
export const resolveStrategyModelConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): StrategyModelConfig | null => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === STRATEGY_CAPABILITY
  );
  if (!configuration?.valid) return null;

  const schemaId = (role: string): string | null => {
    const binding = configuration.bindings[role];
    return binding?.target.kind === 'entity_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  };
  const relationSchemaId = (role: string): string | null => {
    const binding = configuration.bindings[role];
    return binding?.target.kind === 'relation_schema' && binding.target.id.length > 0
      ? binding.target.id
      : null;
  };

  const objectiveSchemaId = schemaId('objective');
  const outcomeSchemaId = schemaId('outcome');
  const initiativeSchemaId = schemaId('initiative');
  const measureSchemaId = schemaId('measure');
  const businessCapabilitySchemaId = schemaId('business_capability');
  const objectiveSupportsBusinessCapabilityRelationSchemaId = relationSchemaId(
    'objective_supports_business_capability'
  );
  const businessCapabilitySupportsEntityRelationSchemaId = relationSchemaId(
    'business_capability_supports_entity'
  );

  if (
    !objectiveSchemaId ||
    !outcomeSchemaId ||
    !initiativeSchemaId ||
    !measureSchemaId ||
    !businessCapabilitySchemaId ||
    !objectiveSupportsBusinessCapabilityRelationSchemaId ||
    !businessCapabilitySupportsEntityRelationSchemaId
  ) {
    return null;
  }

  return {
    objectiveSchemaId,
    outcomeSchemaId,
    initiativeSchemaId,
    measureSchemaId,
    businessCapabilitySchemaId,
    objectiveSupportsBusinessCapabilityRelationSchemaId,
    businessCapabilitySupportsEntityRelationSchemaId
  };
};
