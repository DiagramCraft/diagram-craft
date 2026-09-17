import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveApiIntegrationCatalogConfig } from './apiIntegrationCatalogQueries';

const binding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });

const validConfiguration = {
  type: 'api-specification',
  valid: true,
  bindings: {
    api: binding('api-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveApiIntegrationCatalogConfig', () => {
  it('resolves the api binding from a valid api-specification configuration', () => {
    expect(resolveApiIntegrationCatalogConfig([validConfiguration])).toEqual({
      apiSchemaId: 'api-schema'
    });
  });

  it('returns null when there is no api-specification configuration', () => {
    expect(resolveApiIntegrationCatalogConfig([])).toBeNull();
    expect(resolveApiIntegrationCatalogConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveApiIntegrationCatalogConfig([{ ...validConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when the required api binding is missing or unbound', () => {
    const { api: _api, ...bindingsWithoutApi } = validConfiguration.bindings;
    expect(
      resolveApiIntegrationCatalogConfig([{ ...validConfiguration, bindings: bindingsWithoutApi }])
    ).toBeNull();
    expect(
      resolveApiIntegrationCatalogConfig([
        {
          ...validConfiguration,
          bindings: { ...validConfiguration.bindings, api: binding('') }
        }
      ])
    ).toBeNull();
  });
});
