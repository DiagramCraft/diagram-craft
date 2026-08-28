import { describe, expect, it } from 'vitest';
import { demoBusinessCapabilityEntities, demoSeedEntities } from './demoStrategyEntities';
import { STRATEGY_IDS } from './constants';

describe('demo bootstrap dataset: Business Capability tree', () => {
  it('has 50 capabilities with unique ids, public ids, and slugs', () => {
    expect(demoBusinessCapabilityEntities).toHaveLength(50);
    expect(new Set(demoBusinessCapabilityEntities.map(entity => entity.id)).size).toBe(50);
    expect(new Set(demoBusinessCapabilityEntities.map(entity => entity.public_id)).size).toBe(50);
    expect(new Set(demoBusinessCapabilityEntities.map(entity => entity.slug)).size).toBe(50);
  });

  it('every capability is L1, or has a parent that is itself a demo capability', () => {
    const byId = new Map(demoBusinessCapabilityEntities.map(entity => [entity.id, entity]));

    const depthOf = (id: string, seen: Set<string> = new Set()): number => {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      const entity = byId.get(id);
      expect(entity).toBeDefined();
      const parents = entity!.data['parent'] as string[];
      expect(parents.length).toBeLessThanOrEqual(1);
      if (parents.length === 0) return 1;
      const parent = byId.get(parents[0]!);
      expect(parent).toBeDefined();
      expect(parent!.schema_id).toBe(STRATEGY_IDS.businessCapabilitySchema);
      return 1 + depthOf(parents[0]!, seen);
    };

    for (const entity of demoBusinessCapabilityEntities) {
      expect(depthOf(entity.id)).toBeLessThanOrEqual(3);
    }
  });

  it('replaces the test dataset capabilities one-for-one in demoSeedEntities', () => {
    const capabilities = demoSeedEntities.filter(
      entity => entity.schema_id === STRATEGY_IDS.businessCapabilitySchema
    );
    expect(capabilities).toHaveLength(50);
    const testCapabilityIds = new Set<string>(Object.values(STRATEGY_IDS.businessCapabilities));
    for (const capability of capabilities) {
      expect(testCapabilityIds.has(capability.id)).toBe(false);
    }
  });
});
