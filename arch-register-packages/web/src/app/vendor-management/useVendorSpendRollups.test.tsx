// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { useVendorSpendRollups, type VendorSpendRollups } from './useVendorSpendRollups';

const mocks = vi.hoisted(() => ({ rollup: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { metrics: { rollup: mocks.rollup } }
}));

const emptyLegend = { min: null, max: null };

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

let latest: VendorSpendRollups | undefined;

const Harness = ({ vendorIds }: { vendorIds: string[] }) => {
  latest = useVendorSpendRollups('ws-1', 'contract', vendorIds);
  return null;
};

describe('useVendorSpendRollups', () => {
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

  const render = (vendorIds: string[]) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness vendorIds={vendorIds} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns an empty map when there are no vendor ids', () => {
    render([]);
    expect(latest?.byId.size).toBe(0);
    expect(mocks.rollup).not.toHaveBeenCalled();
  });

  it('batches every vendor id into a single request, keyed by vendor uid in the result map', async () => {
    mocks.rollup.mockResolvedValue({
      results: [result('vnd-1', 10000), result('vnd-2', 25000)],
      legend: emptyLegend
    });
    render(['vnd-1', 'vnd-2']);
    await flush();

    expect(mocks.rollup).toHaveBeenCalledTimes(1);
    const [request] = mocks.rollup.mock.calls[0]!;
    expect(request.body.boxEntityIds).toEqual(['vnd-1', 'vnd-2']);

    expect(latest?.byId.get('vnd-1')).toEqual({ vmSpend: 10000, currency: 'USD', contractCount: 2 });
    expect(latest?.byId.get('vnd-2')).toEqual({ vmSpend: 25000, currency: 'USD', contractCount: 2 });
  });

  it('fills in a null entry for a vendor id missing from the response', async () => {
    mocks.rollup.mockResolvedValue({ results: [result('vnd-1', 10000)], legend: emptyLegend });
    render(['vnd-1', 'vnd-2']);
    await flush();

    expect(latest?.byId.get('vnd-2')).toEqual({ vmSpend: null, currency: null, contractCount: null });
  });
});
