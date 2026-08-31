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
import {
  demoTermCategoryEntities,
  demoTermEntities
} from '../../app/business-glossary/demoGlossaryEntities';
import {
  demoResourceEntities,
  demoTechnologyEntities,
  demoTechnologyReleaseEntities
} from './demoTechnologyEntities';
import {
  demoApiEntities,
  demoComponentEntities,
  demoDataEntityEntities,
  demoDomainEntities,
  demoSystemEntities
} from './demoArchitectureEntities';
import { demoArchitectureRelations } from './demoArchitectureRelations';
import { demoContractEntities, demoVendorEntities } from './demoVendorEntities';
import { demoVendorRelations } from './demoVendorRelations';
import {
  DEMO_TECHNOLOGY_IDS,
  GLOSSARY_IDS,
  RETENTION_IDS,
  SEED_SCHEMA_IDS,
  STRATEGY_IDS,
  TECHNOLOGY_RELEASE_IDS
} from './constants';

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
  GLOSSARY_IDS.termSchema,
  SEED_SCHEMA_IDS.technology,
  SEED_SCHEMA_IDS.technologyRelease,
  SEED_SCHEMA_IDS.resource
];

// The test-dataset Components (kept as-is since Component isn't a replaced schema) reference
// specific Technology Release ids in their data.technology_releases field - a plain reference, not
// a relation row, so it isn't caught by the entity-existence relation filter below. Remap them to
// their matching new demo Technology Release instead of leaving them dangling.
const OLD_TO_DEMO_TECHNOLOGY_RELEASE_ID: Record<string, string> = {
  [TECHNOLOGY_RELEASE_IDS.nodejs20]: DEMO_TECHNOLOGY_IDS.releases.nodejs22,
  [TECHNOLOGY_RELEASE_IDS.react18]: DEMO_TECHNOLOGY_IDS.releases.react19,
  [TECHNOLOGY_RELEASE_IDS.go122]: DEMO_TECHNOLOGY_IDS.releases.go123,
  [TECHNOLOGY_RELEASE_IDS.python312]: DEMO_TECHNOLOGY_IDS.releases.python313,
  [TECHNOLOGY_RELEASE_IDS.java21]: DEMO_TECHNOLOGY_IDS.releases.java21,
  [TECHNOLOGY_RELEASE_IDS.rust182]: DEMO_TECHNOLOGY_IDS.releases.rust182,
  [TECHNOLOGY_RELEASE_IDS.postgres15]: DEMO_TECHNOLOGY_IDS.releases.postgres16,
  [TECHNOLOGY_RELEASE_IDS.redis7]: DEMO_TECHNOLOGY_IDS.releases.redis75,
  [TECHNOLOGY_RELEASE_IDS.kafka37]: DEMO_TECHNOLOGY_IDS.releases.kafka38,
  [TECHNOLOGY_RELEASE_IDS.elasticsearch8]: DEMO_TECHNOLOGY_IDS.releases.elasticsearch815
};

export const demoSeedEntitiesRaw: SeedEntityInput[] = [
  ...seedEntitiesRaw
    .filter(entity => !DEMO_REPLACED_SCHEMA_IDS.includes(entity.schema_id))
    .map(entity => {
      const releases = entity.data['technology_releases'] as string[] | undefined;
      if (!releases) return entity;
      return {
        ...entity,
        data: {
          ...entity.data,
          technology_releases: releases.map(id => OLD_TO_DEMO_TECHNOLOGY_RELEASE_ID[id] ?? id)
        }
      };
    }),
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
  ...demoTermEntities,
  ...demoTechnologyEntities,
  ...demoTechnologyReleaseEntities,
  ...demoResourceEntities,
  ...demoDomainEntities,
  ...demoSystemEntities,
  ...demoComponentEntities,
  ...demoApiEntities,
  ...demoDataEntityEntities,
  ...demoVendorEntities,
  ...demoContractEntities
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
  ...demoGovernanceRelations,
  ...demoArchitectureRelations,
  ...demoVendorRelations
];

export const demoSeedProjectEntities = seedProjectEntities.filter(link =>
  demoEntityIds.has(link.entity_id)
);
