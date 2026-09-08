import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveStrategyModelConfig } from './strategyQueries';

const binding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });

const validConfiguration = {
  type: 'strategy-model',
  valid: true,
  bindings: {
    objective: binding('objective-schema'),
    outcome: binding('outcome-schema'),
    initiative: binding('initiative-schema'),
    measure: binding('measure-schema'),
    business_capability: binding('capability-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveStrategyModelConfig', () => {
  it('resolves every binding role from a valid strategy-model configuration', () => {
    expect(resolveStrategyModelConfig([validConfiguration])).toEqual({
      objectiveSchemaId: 'objective-schema',
      outcomeSchemaId: 'outcome-schema',
      initiativeSchemaId: 'initiative-schema',
      measureSchemaId: 'measure-schema',
      businessCapabilitySchemaId: 'capability-schema'
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
          bindings: { ...validConfiguration.bindings, measure: binding('') }
        }
      ])
    ).toBeNull();
  });
});
