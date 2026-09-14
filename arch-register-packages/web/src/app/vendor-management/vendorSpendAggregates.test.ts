import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { computeVmGroupSpend, computeVmTotalSpend } from './vendorSpendAggregates';
import type { VendorSpendRollupValue } from './useVendorSpendRollups';

const vendor = (uid: string, fields: Record<string, unknown> = {}): EntityRecord =>
  ({ _uid: uid, _name: uid, _publicId: uid, ...fields }) as unknown as EntityRecord;

describe('computeVmTotalSpend', () => {
  it('sums spend across every vendor in the map, treating null as 0', () => {
    const byId = new Map<string, VendorSpendRollupValue>([
      ['vnd-1', { vmSpend: 10000, currency: 'USD', contractCount: 2 }],
      ['vnd-2', { vmSpend: null, currency: null, contractCount: 0 }],
      ['vnd-3', { vmSpend: 5000, currency: 'USD', contractCount: 1 }]
    ]);
    expect(computeVmTotalSpend(byId)).toBe(15000);
  });

  it('returns 0 for an empty map', () => {
    expect(computeVmTotalSpend(new Map())).toBe(0);
  });
});

describe('computeVmGroupSpend', () => {
  it('groups spend by the vendor field value', () => {
    const vendors = [
      vendor('vnd-1', { cost_centre: 'engineering' }),
      vendor('vnd-2', { cost_centre: 'engineering' }),
      vendor('vnd-3', { cost_centre: 'finance-admin' })
    ];
    const byId = new Map<string, VendorSpendRollupValue>([
      ['vnd-1', { vmSpend: 10000, currency: 'USD', contractCount: 1 }],
      ['vnd-2', { vmSpend: 2000, currency: 'USD', contractCount: 1 }],
      ['vnd-3', { vmSpend: 3000, currency: 'USD', contractCount: 1 }]
    ]);
    const groups = computeVmGroupSpend(vendors, byId, 'cost_centre');
    expect(groups.get('engineering')).toBe(12000);
    expect(groups.get('finance-admin')).toBe(3000);
  });

  it('groups vendors with no value under "—"', () => {
    const vendors = [vendor('vnd-1')];
    const byId = new Map<string, VendorSpendRollupValue>([
      ['vnd-1', { vmSpend: 500, currency: 'USD', contractCount: 1 }]
    ]);
    const groups = computeVmGroupSpend(vendors, byId, 'cost_centre');
    expect(groups.get('—')).toBe(500);
  });
});
