import { describe, expect, it } from 'vitest';
import {
  demoBusinessCapabilityEntities,
  demoInitiativeEntities,
  demoMeasureEntities,
  demoObjectiveEntities,
  demoOutcomeEntities
} from './demoStrategyEntities';
import {
  demoComplianceRequirementEntities,
  demoControlEntities,
  demoFrameworkEntities,
  demoRetentionPolicyEntities,
  demoRiskEntities
} from './demoGovernanceEntities';
import { demoTermCategoryEntities, demoTermEntities } from './demoGlossaryEntities';
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
import { demoContractEntities, demoVendorEntities } from './demoVendorEntities';
import { demoSeedEntitiesRaw, demoSeedRelations } from './demoDataset';
import { SEED_RELATION_SCHEMA_IDS } from './constants';
import {
  CONTROL_REQUIREMENT_SCHEMA_ID,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  RETENTION_IDS,
  RISK_CONTROL_SCHEMA_ID
} from './constants';

describe('demo bootstrap dataset: strategy entities', () => {
  it('has no duplicate ids and every parent/reference field resolves', () => {
    const allEntities = [
      ...demoBusinessCapabilityEntities,
      ...demoObjectiveEntities,
      ...demoOutcomeEntities,
      ...demoInitiativeEntities,
      ...demoMeasureEntities
    ];
    const byId = new Map(allEntities.map(entity => [entity.id, entity]));
    expect(byId.size).toBe(allEntities.length);

    const objectiveIds = new Set(demoObjectiveEntities.map(entity => entity.id));
    const outcomeIds = new Set(demoOutcomeEntities.map(entity => entity.id));
    const capabilityIds = new Set(demoBusinessCapabilityEntities.map(entity => entity.id));

    for (const capability of demoBusinessCapabilityEntities) {
      for (const id of capability.data['parent'] as string[]) expect(byId.has(id)).toBe(true);
    }
    for (const outcome of demoOutcomeEntities) {
      for (const id of outcome.data['objectives'] as string[])
        expect(objectiveIds.has(id)).toBe(true);
    }
    for (const initiative of demoInitiativeEntities) {
      for (const id of initiative.data['objectives'] as string[])
        expect(objectiveIds.has(id)).toBe(true);
      for (const id of initiative.data['outcomes'] as string[])
        expect(outcomeIds.has(id)).toBe(true);
    }
    for (const measure of demoMeasureEntities) {
      for (const id of measure.data['outcomes'] as string[]) expect(outcomeIds.has(id)).toBe(true);
    }

    for (const relation of demoSeedRelations) {
      if (relation.schema_id !== OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID)
        continue;
      expect(objectiveIds.has(relation.in_entity_id)).toBe(true);
      expect(capabilityIds.has(relation.out_entity_id)).toBe(true);
    }
  });
});

describe('demo bootstrap dataset: governance entities', () => {
  it('has no duplicate ids and every framework/relation reference resolves', () => {
    const allEntities = [
      ...demoFrameworkEntities,
      ...demoComplianceRequirementEntities,
      ...demoControlEntities,
      ...demoRiskEntities,
      ...demoRetentionPolicyEntities
    ];
    const byId = new Map(allEntities.map(entity => [entity.id, entity]));
    expect(byId.size).toBe(allEntities.length);

    const frameworkIds = new Set(demoFrameworkEntities.map(entity => entity.id));
    const controlIds = new Set(demoControlEntities.map(entity => entity.id));
    const requirementIds = new Set(demoComplianceRequirementEntities.map(entity => entity.id));
    const riskIds = new Set(demoRiskEntities.map(entity => entity.id));
    const policyIds = new Set(demoRetentionPolicyEntities.map(entity => entity.id));

    for (const requirement of demoComplianceRequirementEntities) {
      for (const id of requirement.data['framework'] as string[])
        expect(frameworkIds.has(id)).toBe(true);
    }

    for (const relation of demoSeedRelations) {
      if (relation.schema_id === RISK_CONTROL_SCHEMA_ID) {
        expect(riskIds.has(relation.in_entity_id)).toBe(true);
        expect(controlIds.has(relation.out_entity_id)).toBe(true);
      } else if (relation.schema_id === CONTROL_REQUIREMENT_SCHEMA_ID) {
        expect(controlIds.has(relation.in_entity_id)).toBe(true);
        expect(requirementIds.has(relation.out_entity_id)).toBe(true);
      } else if (relation.schema_id === RETENTION_IDS.assignmentRelationSchema) {
        expect(policyIds.has(relation.out_entity_id)).toBe(true);
      }
    }
  });
});

describe('demo bootstrap dataset: business glossary', () => {
  it('has no duplicate ids and every term category reference resolves', () => {
    const allEntities = [...demoTermCategoryEntities, ...demoTermEntities];
    const byId = new Map(allEntities.map(entity => [entity.id, entity]));
    expect(byId.size).toBe(allEntities.length);

    const categoryIds = new Set(demoTermCategoryEntities.map(entity => entity.id));
    for (const termEntity of demoTermEntities) {
      const categories = termEntity.data['categories'] as string[];
      expect(categories.length).toBeGreaterThan(0);
      for (const id of categories) expect(categoryIds.has(id)).toBe(true);
    }
  });
});

describe('demo bootstrap dataset: technology stack', () => {
  it('has no duplicate ids and every technology/resource reference resolves', () => {
    const allEntities = [
      ...demoTechnologyEntities,
      ...demoTechnologyReleaseEntities,
      ...demoResourceEntities
    ];
    const byId = new Map(allEntities.map(entity => [entity.id, entity]));
    expect(byId.size).toBe(allEntities.length);

    const technologyIds = new Set(demoTechnologyEntities.map(entity => entity.id));
    const releaseIds = new Set(demoTechnologyReleaseEntities.map(entity => entity.id));

    for (const release of demoTechnologyReleaseEntities) {
      for (const id of release.data['technology'] as string[])
        expect(technologyIds.has(id)).toBe(true);
    }
    for (const resource of demoResourceEntities) {
      const releases = resource.data['technology_releases'] as string[] | undefined;
      for (const id of releases ?? []) expect(releaseIds.has(id)).toBe(true);
    }
  });
});

describe('demo bootstrap dataset: additional architecture entities', () => {
  it('has no id collisions with the rest of the demo dataset and every domain/system reference resolves', () => {
    const newEntities = [
      ...demoDomainEntities,
      ...demoSystemEntities,
      ...demoComponentEntities,
      ...demoApiEntities,
      ...demoDataEntityEntities
    ];
    const newIds = new Set(newEntities.map(entity => entity.id));
    expect(newIds.size).toBe(newEntities.length);

    // The whole demo dataset (base + all additions) must still have no duplicate ids - these
    // architecture entities are additive, not a replacement, so this is the one place that would
    // catch an accidental id collision with the base test dataset.
    const allDemoIds = new Set(demoSeedEntitiesRaw.map(entity => entity.id));
    expect(allDemoIds.size).toBe(demoSeedEntitiesRaw.length);

    const domainIds = new Set(
      demoSeedEntitiesRaw
        .filter(e => e.schema_id === demoDomainEntities[0]!.schema_id)
        .map(e => e.id)
    );
    const systemIds = new Set(
      demoSeedEntitiesRaw
        .filter(e => e.schema_id === demoSystemEntities[0]!.schema_id)
        .map(e => e.id)
    );

    for (const system of demoSystemEntities) {
      for (const id of system.data['domain'] as string[]) expect(domainIds.has(id)).toBe(true);
    }
    for (const component of demoComponentEntities) {
      for (const id of component.data['system'] as string[]) expect(systemIds.has(id)).toBe(true);
    }
    for (const api of demoApiEntities) {
      for (const id of api.data['system'] as string[]) expect(systemIds.has(id)).toBe(true);
    }
  });
});

describe('demo bootstrap dataset: additional vendors and contracts', () => {
  it('has no duplicate ids, every contract vendor resolves, and system-contract relations are valid', () => {
    const allEntities = [...demoVendorEntities, ...demoContractEntities];
    const byId = new Map(allEntities.map(entity => [entity.id, entity]));
    expect(byId.size).toBe(allEntities.length);

    const vendorIds = new Set(demoVendorEntities.map(entity => entity.id));
    const contractIds = new Set(demoContractEntities.map(entity => entity.id));

    for (const contract of demoContractEntities) {
      for (const id of contract.data['vendor'] as string[]) expect(vendorIds.has(id)).toBe(true);
    }

    const allocationByContract = new Map<string, number>();
    for (const relation of demoSeedRelations) {
      if (relation.schema_id !== SEED_RELATION_SCHEMA_IDS.systemContract) continue;
      if (!contractIds.has(relation.out_entity_id)) continue;
      const allocation = (relation.data as { allocation?: number }).allocation ?? 0;
      allocationByContract.set(
        relation.out_entity_id,
        (allocationByContract.get(relation.out_entity_id) ?? 0) + allocation
      );
    }
    for (const total of allocationByContract.values()) expect(total).toBeLessThanOrEqual(100);
  });
});
