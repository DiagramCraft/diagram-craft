import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { isChangeCasesWorkflowEnabled, resolveDataStewardshipConfig } from './dataStewardshipQueries';

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

describe('isChangeCasesWorkflowEnabled', () => {
  const config = { dataEntitySchemaId: 'data-entity-schema' };

  it('is false when there is no data-stewardship config at all', () => {
    expect(isChangeCasesWorkflowEnabled([{ id: 'data-entity-schema', entity_approval_policy: 'required' }], null))
      .toBe(false);
  });

  it('is false when the configured schema is missing from the schema list', () => {
    expect(isChangeCasesWorkflowEnabled([], config)).toBe(false);
    expect(isChangeCasesWorkflowEnabled(undefined, config)).toBe(false);
  });

  it('is false when the schema has no approval policy, or an explicitly disabled one', () => {
    expect(isChangeCasesWorkflowEnabled([{ id: 'data-entity-schema' }], config)).toBe(false);
    expect(
      isChangeCasesWorkflowEnabled(
        [{ id: 'data-entity-schema', entity_approval_policy: 'disabled' }],
        config
      )
    ).toBe(false);
  });

  it('is true when the schema has entity_approval_policy required', () => {
    expect(
      isChangeCasesWorkflowEnabled(
        [{ id: 'data-entity-schema', entity_approval_policy: 'required' }],
        config
      )
    ).toBe(true);
  });
});
