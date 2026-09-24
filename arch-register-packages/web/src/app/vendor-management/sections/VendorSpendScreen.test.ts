import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { VendorContractRow } from '../useVendorContracts';
import type { VendorSpendRollupValue } from '../useVendorSpendRollups';
import { buildSpendRows } from './VendorSpendScreen';

const vendor = (uid: string, name: string, publicId: string, costCentre: string): EntityRecord =>
  ({
    _uid: uid,
    _name: name,
    _publicId: publicId,
    cost_centre: costCentre
  }) as unknown as EntityRecord;

const contractRow = (uid: string, vendorId: string, annualCost: number): VendorContractRow => ({
  contract: {
    _uid: uid,
    _publicId: uid.toUpperCase(),
    _name: `Contract ${uid}`,
    annual_cost: { amount: annualCost, currency: 'USD' }
  } as never,
  vendorId,
  vendorName: null
});

const VENDOR_SCHEMA: EntitySchema = {
  id: 'vendor',
  name: 'Vendor',
  icon: 'building',
  color: null,
  fields: [
    {
      id: 'cost_centre',
      name: 'Cost Centre',
      type: 'select',
      options: [
        { value: 'engineering', label: 'Engineering' },
        { value: 'sales', label: 'Sales' }
      ]
    }
  ]
} as unknown as EntitySchema;

describe('buildSpendRows', () => {
  const vendors = [
    vendor('vnd-1', 'Acme Corp', 'VND-001', 'engineering'),
    vendor('vnd-2', 'Beta Supplies', 'VND-002', 'sales')
  ];
  const spendById = new Map<string, VendorSpendRollupValue>([
    ['vnd-1', { vmSpend: 3000, currency: 'USD', sourceCount: 2 } as unknown as VendorSpendRollupValue],
    ['vnd-2', { vmSpend: 1000, currency: 'USD', sourceCount: 1 } as unknown as VendorSpendRollupValue]
  ]);
  const contractItems = [
    contractRow('ctr-1', 'vnd-1', 2000),
    contractRow('ctr-2', 'vnd-1', 1000),
    contractRow('ctr-3', 'vnd-2', 1000)
  ];
  const contractsByVendorUid = new Map<string, VendorContractRow[]>([
    ['vnd-1', [contractRow('ctr-1', 'vnd-1', 2000), contractRow('ctr-2', 'vnd-1', 1000)]],
    ['vnd-2', [contractRow('ctr-3', 'vnd-2', 1000)]]
  ]);
  const costCentreByVendorUid = new Map([
    ['vnd-1', 'engineering'],
    ['vnd-2', 'sales']
  ]);

  it('groups by vendor and sorts by spend descending', () => {
    const rows = buildSpendRows({
      group: 'vendor',
      scopedVendors: vendors,
      spendById,
      contractItems,
      contractsByVendorUid,
      costCentreByVendorUid,
      vendorSchema: VENDOR_SCHEMA
    });
    expect(rows.map(r => r.label)).toEqual(['Acme Corp', 'Beta Supplies']);
    expect(rows[0]!.amount).toBe(3000);
    expect(rows[0]!.contractCount).toBe(2);
    expect(rows[0]!.largestContractName).toBe('Contract ctr-1');
  });

  it('groups by cost centre, resolving the select field label', () => {
    const rows = buildSpendRows({
      group: 'costCentre',
      scopedVendors: vendors,
      spendById,
      contractItems,
      contractsByVendorUid,
      costCentreByVendorUid,
      vendorSchema: VENDOR_SCHEMA
    });
    expect(rows.map(r => r.label).sort()).toEqual(['Engineering', 'Sales']);
    const engineering = rows.find(r => r.label === 'Engineering');
    expect(engineering?.amount).toBe(3000);
    expect(engineering?.contractCount).toBe(2);
  });

  it('returns no rows when grouped by capability', () => {
    const rows = buildSpendRows({
      group: 'capability',
      scopedVendors: vendors,
      spendById,
      contractItems,
      contractsByVendorUid,
      costCentreByVendorUid,
      vendorSchema: VENDOR_SCHEMA
    });
    expect(rows).toEqual([]);
  });
});
