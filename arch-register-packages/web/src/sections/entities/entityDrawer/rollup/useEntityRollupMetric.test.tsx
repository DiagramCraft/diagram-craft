// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { useEntityRollupMetric, type EntityRollupMetric } from './useEntityRollupMetric';
import { useEntityRollupLeafCount, type EntityRollupLeafCount } from './useEntityRollupLeafCount';

const mocks = vi.hoisted(() => ({ rollup: vi.fn() }));

vi.mock('../../../../lib/orpcClient', () => ({
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

let latestMetric: EntityRollupMetric | undefined;
let latestLeafCount: EntityRollupLeafCount | undefined;

const MetricHarness = ({
  fieldId,
  aggregation
}: {
  fieldId: 'maturity' | 'annual_investment';
  aggregation: 'avg' | 'sum' | 'count';
}) => {
  latestMetric = useEntityRollupMetric(
    'ws-1',
    'business_capability',
    'cap-1',
    fieldId,
    aggregation
  );
  return null;
};

const RelationMetricHarness = () => {
  latestMetric = useEntityRollupMetric(
    'ws-1',
    'vendor',
    'vendor-1',
    'annual_cost',
    'count',
    undefined,
    'contract',
    {
      kind: 'relation',
      fieldId: 'vendor',
      direction: 'backward',
      ownerSchemaId: 'contract'
    }
  );
  return null;
};

const LeafCountHarness = () => {
  latestLeafCount = useEntityRollupLeafCount('ws-1', 'business_capability', 'cap-1', 'maturity');
  return null;
};

describe('useEntityRollupMetric / useEntityRollupLeafCount', () => {
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
    latestMetric = undefined;
    latestLeafCount = undefined;

    mocks.rollup.mockImplementation(
      ({ body }: { body: { metric: { source: { fieldId: string }; aggregation: string } } }) => {
        const { fieldId } = body.metric.source;
        if (body.metric.aggregation === 'leafCount') return Promise.resolve(resultFor(2));
        if (body.metric.aggregation === 'count')
          return Promise.resolve(resultFor(4, { boxEntityId: 'vendor-1' }));
        if (fieldId === 'maturity') return Promise.resolve(resultFor(3));
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

  const flush = async (predicate: () => boolean) => {
    for (let i = 0; i < 5 && !predicate(); i++) {
      await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('aggregates a numeric roll-up field', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MetricHarness fieldId="maturity" aggregation="avg" />
        </QueryClientProvider>
      );
    });
    await flush(() => latestMetric?.isLoading === false);

    expect(latestMetric).toMatchObject({ value: 3, currency: null, isLoading: false, error: null });
  });

  it('carries the currency code for currency-typed fields', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MetricHarness fieldId="annual_investment" aggregation="sum" />
        </QueryClientProvider>
      );
    });
    await flush(() => latestMetric?.isLoading === false);

    expect(latestMetric).toMatchObject({ value: 150000, currency: 'USD' });
  });

  it('counts relation sources without applying the own-entity fallback', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RelationMetricHarness />
        </QueryClientProvider>
      );
    });
    await flush(() => latestMetric?.isLoading === false);

    expect(latestMetric).toMatchObject({ value: 4, currency: null, error: null });
    expect(mocks.rollup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          metric: expect.objectContaining({
            sourceSchemaId: 'contract',
            aggregation: 'count',
            path: [
              {
                kind: 'relation',
                fieldId: 'vendor',
                direction: 'backward',
                ownerSchemaId: 'contract'
              }
            ]
          })
        })
      })
    );
  });

  it('resolves the leaf count independently of any roll-up field', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <LeafCountHarness />
        </QueryClientProvider>
      );
    });
    await flush(() => latestLeafCount?.isLoading === false);

    expect(latestLeafCount).toMatchObject({ leafCount: 2, isLoading: false, error: null });
  });
});
