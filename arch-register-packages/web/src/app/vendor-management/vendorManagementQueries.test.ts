import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { resolveVendorManagementConfig } from './vendorManagementQueries';

const binding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });

const validConfiguration = {
  type: 'vendor-management',
  valid: true,
  bindings: {
    vendor: binding('vendor-schema'),
    contract: binding('contract-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveVendorManagementConfig', () => {
  it('resolves the vendor and contract bindings from a valid vendor-management configuration', () => {
    expect(resolveVendorManagementConfig([validConfiguration])).toEqual({
      vendorSchemaId: 'vendor-schema',
      contractSchemaId: 'contract-schema'
    });
  });

  it('resolves with a null contract schema id when contract is unbound', () => {
    const { contract: _contract, ...bindingsWithoutContract } = validConfiguration.bindings;
    expect(
      resolveVendorManagementConfig([
        { ...validConfiguration, bindings: bindingsWithoutContract }
      ])
    ).toEqual({ vendorSchemaId: 'vendor-schema', contractSchemaId: null });
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
