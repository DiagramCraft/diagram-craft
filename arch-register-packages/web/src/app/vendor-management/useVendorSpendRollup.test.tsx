// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { useVendorSpendRollup, type VendorSpendRollup } from './useVendorSpendRollup';

const mocks = vi.hoisted(() => ({ rollup: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { metrics: { rollup: mocks.rollup } }
}));

const emptyLegend = { min: null, max: null };

const resultFor = (
  value: number | null,
  extra: Partial<MetricRollupResponse['results'][number]> = {}
): MetricRollupResponse => ({
  results: [
    {
      boxEntityId: 'vnd-1',
      value,
      lifecycleId: null,
      dominantValue: null,
      dominantLabel: null,
      distribution: [],
      sourceCount: 3,
      populatedCount: 3,
      duplicateCount: 0,
      currencyCode: 'USD',
      currencyMixed: false,
      ...extra
    }
  ],
  legend: emptyLegend
});

let latest: VendorSpendRollup | undefined;

const Harness = ({ vendorId }: { vendorId: string | null }) => {
  latest = useVendorSpendRollup('ws-1', 'contract', vendorId);
  return null;
};

describe('useVendorSpendRollup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.rollup.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (vendorId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness vendorId={vendorId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no vendorId)', () => {
    render(null);
    expect(latest).toEqual({
      vmSpend: null,
      currency: null,
      contractCount: null,
      isLoading: false,
      error: null
    });
    expect(mocks.rollup).not.toHaveBeenCalled();
  });

  it("sums annual_cost across the vendor's contracts via a single-hop backward containment metric", async () => {
    mocks.rollup.mockResolvedValue(resultFor(45000));
    render('vnd-1');
    await flush();

    expect(latest?.vmSpend).toBe(45000);
    expect(latest?.currency).toBe('USD');
    expect(latest?.contractCount).toBe(3);

    const [request] = mocks.rollup.mock.calls[0]!;
    expect(request.body.boxEntityIds).toEqual(['vnd-1']);
    expect(request.body.metric).toEqual({
      sourceSchemaId: 'contract',
      source: { kind: 'field', fieldId: 'annual_cost' },
      aggregation: 'sum',
      traversalPath: [{ kind: 'backward', fieldId: 'vendor', ownerSchemaId: 'contract' }]
    });
  });

  it('reports null spend (not an error) for a vendor with zero contracts', async () => {
    mocks.rollup.mockResolvedValue(resultFor(null, { sourceCount: 0, currencyCode: null }));
    render('vnd-1');
    await flush();

    expect(latest?.vmSpend).toBeNull();
    expect(latest?.contractCount).toBe(0);
    expect(latest?.error).toBeNull();
  });

  it('surfaces a query error', async () => {
    mocks.rollup.mockRejectedValue(new Error('boom'));
    render('vnd-1');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
