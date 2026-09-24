import { describe, expect, it } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { buildVendorSpendRollupMap } from './useVendorSpendRollups';

const result = (
  boxEntityId: string,
  value: number | null,
  extra: Partial<MetricRollupResponse['results'][number]> = {}
): MetricRollupResponse['results'][number] => ({
  boxEntityId,
  value,
  lifecycleId: null,
  dominantValue: null,
  dominantLabel: null,
  distribution: [],
  sourceCount: 2,
  populatedCount: 2,
  duplicateCount: 0,
  currencyCode: 'USD',
  currencyMixed: false,
  ...extra
});

describe('buildVendorSpendRollupMap', () => {
  it('keys the rollup results by vendor uid', () => {
    const map = buildVendorSpendRollupMap(['vnd-1', 'vnd-2'], {
      results: [result('vnd-1', 10000), result('vnd-2', 25000)],
      legend: { min: null, max: null }
    });

    expect(map.get('vnd-1')).toEqual({ vmSpend: 10000, currency: 'USD', contractCount: 2 });
    expect(map.get('vnd-2')).toEqual({ vmSpend: 25000, currency: 'USD', contractCount: 2 });
  });

  it('fills in a null entry for a vendor id missing from the response', () => {
    const map = buildVendorSpendRollupMap(['vnd-1', 'vnd-2'], {
      results: [result('vnd-1', 10000)],
      legend: { min: null, max: null }
    });

    expect(map.get('vnd-2')).toEqual({ vmSpend: null, currency: null, contractCount: null });
  });

  it('returns an empty map for no ids', () => {
    expect(buildVendorSpendRollupMap([], undefined).size).toBe(0);
  });
});
