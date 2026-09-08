import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveStrategyModelConfig } from './strategyQueries';

const entityBinding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });
const relationBinding = (id: string) => ({ target: { kind: 'relation_schema' as const, id } });

const validConfiguration = {
  type: 'strategy-model',
  valid: true,
  bindings: {
    objective: entityBinding('objective-schema'),
    outcome: entityBinding('outcome-schema'),
    initiative: entityBinding('initiative-schema'),
    measure: entityBinding('measure-schema'),
    business_capability: entityBinding('capability-schema'),
    objective_supports_business_capability: relationBinding('objective-supports-capability-rel'),
    business_capability_supports_entity: relationBinding('capability-supports-entity-rel')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveStrategyModelConfig', () => {
  it('resolves every binding role from a valid strategy-model configuration', () => {
    expect(resolveStrategyModelConfig([validConfiguration])).toEqual({
      objectiveSchemaId: 'objective-schema',
      outcomeSchemaId: 'outcome-schema',
      initiativeSchemaId: 'initiative-schema',
      measureSchemaId: 'measure-schema',
      businessCapabilitySchemaId: 'capability-schema',
      objectiveSupportsBusinessCapabilityRelationSchemaId: 'objective-supports-capability-rel',
      businessCapabilitySupportsEntityRelationSchemaId: 'capability-supports-entity-rel'
    });
  });

  it('returns null when there is no strategy-model configuration', () => {
    expect(resolveStrategyModelConfig([])).toBeNull();
    expect(resolveStrategyModelConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveStrategyModelConfig([{ ...validConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when any binding role is missing or unbound', () => {
    const { measure: _measure, ...bindingsWithoutMeasure } = validConfiguration.bindings;
    expect(
      resolveStrategyModelConfig([{ ...validConfiguration, bindings: bindingsWithoutMeasure }])
    ).toBeNull();
    expect(
      resolveStrategyModelConfig([
        {
          ...validConfiguration,
          bindings: { ...validConfiguration.bindings, measure: entityBinding('') }
        }
      ])
    ).toBeNull();
  });

  it('returns null when a relation-schema binding role is missing', () => {
    const {
      business_capability_supports_entity: _businessCapabilitySupportsEntity,
      ...bindingsWithoutRelation
    } = validConfiguration.bindings;
    expect(
      resolveStrategyModelConfig([{ ...validConfiguration, bindings: bindingsWithoutRelation }])
    ).toBeNull();
  });
});
