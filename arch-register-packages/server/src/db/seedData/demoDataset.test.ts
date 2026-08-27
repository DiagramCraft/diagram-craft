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
import { demoSeedRelations } from './demoDataset';
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
