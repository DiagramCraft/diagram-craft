import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import type { Entity } from '../../domain/catalog/db/catalogDatabase';
import type { SeedEntityInput } from './entities';
import { normalizeSeedEntities, seedEntitiesRaw } from './entities';
import { seedRelations } from './relations';
import { seedProjectEntities } from './projects';
import {
  demoBusinessCapabilityEntities,
  demoInitiativeEntities,
  demoMeasureEntities,
  demoObjectiveEntities,
  demoOutcomeEntities
} from './demoStrategyEntities';
import { demoStrategyRelations } from './demoStrategyRelations';
import {
  demoComplianceRequirementEntities,
  demoControlEntities,
  demoFrameworkEntities,
  demoRetentionPolicyEntities,
  demoRiskEntities
} from './demoGovernanceEntities';
import { demoGovernanceRelations } from './demoGovernanceRelations';
import { demoTermCategoryEntities, demoTermEntities } from './demoGlossaryEntities';
import { GLOSSARY_IDS, RETENTION_IDS, SEED_SCHEMA_IDS, STRATEGY_IDS } from './constants';

// Composition point for the "demo" bootstrap dataset (`pnpm bootstrap -- --reset`, the default
// dataset). Each domain file (demoStrategyEntities.ts, demoGovernanceEntities.ts, ...) defines only
// its own raw entity/relation arrays; this file is the single place that knows which schemas get
// replaced wholesale and stitches everything into the final demoSeedEntities/demoSeedRelations/
// demoSeedProjectEntities that bootstrapSeed.ts loads. Adding another demo section later means
// adding its schema ids here and spreading its entity/relation arrays in - no other file needs to
// change.
const DEMO_REPLACED_SCHEMA_IDS: string[] = [
  STRATEGY_IDS.businessCapabilitySchema,
  STRATEGY_IDS.objectiveSchema,
  STRATEGY_IDS.outcomeSchema,
  STRATEGY_IDS.initiativeSchema,
  STRATEGY_IDS.measureSchema,
  SEED_SCHEMA_IDS.risk,
  SEED_SCHEMA_IDS.control,
  SEED_SCHEMA_IDS.framework,
  SEED_SCHEMA_IDS.complianceRequirement,
  RETENTION_IDS.policySchema,
  GLOSSARY_IDS.termCategorySchema,
  GLOSSARY_IDS.termSchema
];

export const demoSeedEntitiesRaw: SeedEntityInput[] = [
  ...seedEntitiesRaw.filter(entity => !DEMO_REPLACED_SCHEMA_IDS.includes(entity.schema_id)),
  ...demoBusinessCapabilityEntities,
  ...demoObjectiveEntities,
  ...demoOutcomeEntities,
  ...demoInitiativeEntities,
  ...demoMeasureEntities,
  ...demoFrameworkEntities,
  ...demoComplianceRequirementEntities,
  ...demoControlEntities,
  ...demoRiskEntities,
  ...demoRetentionPolicyEntities,
  ...demoTermCategoryEntities,
  ...demoTermEntities
];

export const demoSeedEntities: Entity[] = normalizeSeedEntities(demoSeedEntitiesRaw);

// Relations and project-entity links only make sense against a dataset that actually contains
// their endpoints. Rather than maintaining a denylist of every relation schema that might
// reference an entity a dataset swap removes, keep any base relation/link whose endpoints both
// still exist in the demo entity set, then layer the demo-specific relations on top.
const demoEntityIds = new Set(demoSeedEntitiesRaw.map(entity => entity.id));

export const demoSeedRelations: RelationDbCreate[] = [
  ...seedRelations.filter(
    relation =>
      demoEntityIds.has(relation.in_entity_id) && demoEntityIds.has(relation.out_entity_id)
  ),
  ...demoStrategyRelations,
  ...demoGovernanceRelations
];

export const demoSeedProjectEntities = seedProjectEntities.filter(link =>
  demoEntityIds.has(link.entity_id)
);
