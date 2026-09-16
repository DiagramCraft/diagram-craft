import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveDataStewardshipConfig } from './dataStewardshipQueries';

const binding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });

const validConfiguration = {
  type: 'data-stewardship',
  valid: true,
  bindings: {
    dataEntity: binding('data-entity-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveDataStewardshipConfig', () => {
  it('resolves the dataEntity binding from a valid data-stewardship configuration', () => {
    expect(resolveDataStewardshipConfig([validConfiguration])).toEqual({
      dataEntitySchemaId: 'data-entity-schema'
    });
  });

  it('returns null when there is no data-stewardship configuration', () => {
    expect(resolveDataStewardshipConfig([])).toBeNull();
    expect(resolveDataStewardshipConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveDataStewardshipConfig([{ ...validConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when the required dataEntity binding is missing or unbound', () => {
    const { dataEntity: _dataEntity, ...bindingsWithoutDataEntity } = validConfiguration.bindings;
    expect(
      resolveDataStewardshipConfig([{ ...validConfiguration, bindings: bindingsWithoutDataEntity }])
    ).toBeNull();
    expect(
      resolveDataStewardshipConfig([
        {
          ...validConfiguration,
          bindings: { ...validConfiguration.bindings, dataEntity: binding('') }
        }
      ])
    ).toBeNull();
  });
});
