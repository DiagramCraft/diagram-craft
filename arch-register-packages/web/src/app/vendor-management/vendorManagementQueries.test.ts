import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveVendorManagementConfig } from './vendorManagementQueries';

const binding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });

const validConfiguration = {
  type: 'vendor-management',
  valid: true,
  bindings: {
    vendor: binding('vendor-schema'),
    contract: binding('contract-schema'),
    technologyRelease: binding('technology-release-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveVendorManagementConfig', () => {
  it('resolves the vendor, contract, and technologyRelease bindings from a valid vendor-management configuration', () => {
    expect(resolveVendorManagementConfig([validConfiguration])).toEqual({
      vendorSchemaId: 'vendor-schema',
      contractSchemaId: 'contract-schema',
      technologyReleaseSchemaId: 'technology-release-schema'
    });
  });

  it('resolves with a null contract/technologyRelease schema id when unbound', () => {
    const {
      contract: _contract,
      technologyRelease: _technologyRelease,
      ...bindingsWithoutOptionals
    } = validConfiguration.bindings;
    expect(
      resolveVendorManagementConfig([{ ...validConfiguration, bindings: bindingsWithoutOptionals }])
    ).toEqual({
      vendorSchemaId: 'vendor-schema',
      contractSchemaId: null,
      technologyReleaseSchemaId: null
    });
  });

  it('returns null when there is no vendor-management configuration', () => {
    expect(resolveVendorManagementConfig([])).toBeNull();
    expect(resolveVendorManagementConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveVendorManagementConfig([{ ...validConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when the required vendor binding is missing or unbound', () => {
    const { vendor: _vendor, ...bindingsWithoutVendor } = validConfiguration.bindings;
    expect(
      resolveVendorManagementConfig([{ ...validConfiguration, bindings: bindingsWithoutVendor }])
    ).toBeNull();
    expect(
      resolveVendorManagementConfig([
        { ...validConfiguration, bindings: { ...validConfiguration.bindings, vendor: binding('') } }
      ])
    ).toBeNull();
  });
});
