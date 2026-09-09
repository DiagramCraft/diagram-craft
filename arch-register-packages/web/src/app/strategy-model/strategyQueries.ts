import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  resolveStrategyModelViewConfig,
  type StrategyModelViewConfig,
  type ViewConfigDiagnostic,
  type ViewConfigSchemaField
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

const STRATEGY_CAPABILITY = 'strategy-model';

export type { StrategyModelViewConfig } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

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

/**
 * Resolve the `strategy-model` capability's admin-configured view config (#3203) against the live
 * `business_capability` schema, dropping references to fields that have been archived/removed.
 * Falls back to {@link DEFAULT_STRATEGY_VIEW_CONFIG} when the workspace has no stored config.
 */
export const resolveStrategyViewConfig = (
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined,
  businessCapabilitySchema: EntitySchema | undefined
): { config: StrategyModelViewConfig; diagnostics: ViewConfigDiagnostic[] } => {
  const configuration = capabilityConfigurations?.find(
    candidate => candidate.type === STRATEGY_CAPABILITY
  );
  const fields: ViewConfigSchemaField[] = (businessCapabilitySchema?.fields ?? []).map(field => ({
    id: field.id,
    type: field.type,
    archived: 'archived' in field ? field.archived : undefined
  }));
  if (!businessCapabilitySchema) {
    return { config: DEFAULT_STRATEGY_VIEW_CONFIG, diagnostics: [] };
  }
  return resolveStrategyModelViewConfig(configuration?.view_config ?? null, fields);
};
