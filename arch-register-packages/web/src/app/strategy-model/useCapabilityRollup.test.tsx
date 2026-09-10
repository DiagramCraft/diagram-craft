// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import type { DerivedRollup } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { useCapabilityRollup, type CapabilityRollup } from './useCapabilityRollup';

const ROLLUPS: DerivedRollup[] = [
  { fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' },
  { fieldId: 'maturity_target', aggregation: 'avg', format: 'decimal1' },
  { fieldId: 'gap', aggregation: 'avg', format: 'decimal1' },
  { fieldId: 'risk', aggregation: 'avg', format: 'decimal1' },
  { fieldId: 'annual_investment', aggregation: 'sum', format: 'currency' }
];

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
      boxEntityId: 'cap-1',
      value,
      lifecycleId: null,
      dominantValue: null,
      dominantLabel: null,
      distribution: [],
      sourceCount: 4,
      populatedCount: 3,
      duplicateCount: 0,
      ...extra
    }
  ],
  legend: emptyLegend
});

let latest: CapabilityRollup | undefined;

const Harness = ({ capabilityId }: { capabilityId: string | null }) => {
  latest = useCapabilityRollup('ws-1', 'business_capability', capabilityId, ROLLUPS);
  return null;
};

describe('useCapabilityRollup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;

    mocks.rollup.mockImplementation(
      ({ body }: { body: { metric: { source: { fieldId: string }; aggregation: string } } }) => {
        const { fieldId } = body.metric.source;
        if (body.metric.aggregation === 'leafCount') return Promise.resolve(resultFor(2));
        if (fieldId === 'maturity') return Promise.resolve(resultFor(3));
        if (fieldId === 'maturity_target') return Promise.resolve(resultFor(4));
        if (fieldId === 'gap') return Promise.resolve(resultFor(1));
        if (fieldId === 'risk') return Promise.resolve(resultFor(2));
        if (fieldId === 'annual_investment') {
          return Promise.resolve(resultFor(150000, { currencyCode: 'USD' }));
        }
        return Promise.resolve(resultFor(null));
      }
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('combines the five metric roll-ups into one object', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness capabilityId="cap-1" />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && latest?.isLoading !== false; i++) {
      await flush();
    }

    expect(latest).toMatchObject({
      values: { maturity: 3, maturity_target: 4, gap: 1, risk: 2, annual_investment: 150000 },
      currency: { annual_investment: 'USD' },
      leafCount: 2,
      sourceCount: 4,
      isLoading: false,
      error: null
    });
    expect(mocks.rollup).toHaveBeenCalledTimes(6);
  });

  it('returns an empty roll-up and skips requests when there is no capability id', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness capabilityId={null} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(latest).toMatchObject({ values: {}, currency: {}, leafCount: null, sourceCount: 0 });
    expect(mocks.rollup).not.toHaveBeenCalled();
  });
});
