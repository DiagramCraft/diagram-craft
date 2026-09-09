// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { RollupField } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { useCapabilityRollups, type CapabilityTableRollup } from './useCapabilityRollups';

const ROLLUPS: RollupField[] = [
  { fieldId: 'maturity', aggregation: 'avg', format: 'decimal1', display: 'plain' },
  { fieldId: 'maturity_target', aggregation: 'avg', format: 'decimal1', display: 'plain' },
  { fieldId: 'gap', aggregation: 'avg', format: 'decimal1', display: 'plain' },
  { fieldId: 'risk', aggregation: 'avg', format: 'decimal1', display: 'plain' },
  { fieldId: 'annual_investment', aggregation: 'sum', format: 'currency', display: 'plain' }
];

const mocks = vi.hoisted(() => ({ rollup: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { metrics: { rollup: mocks.rollup } }
}));

const emptyLegend = { min: null, max: null };

const capability = (uid: string, fields: Partial<EntityRecord> = {}): EntityRecord =>
  ({
    _uid: uid,
    _publicId: uid.toUpperCase(),
    _name: uid,
    _schema: { id: 'business_capability', name: 'Business Capability' },
    _owner: null,
    _lifecycle: null,
    ...fields
  }) as EntityRecord;

const resultsFor = (
  values: Record<string, number | null>,
  sourceCount = 4
): MetricRollupResponse => ({
  results: Object.entries(values).map(([boxEntityId, value]) => ({
    boxEntityId,
    value,
    lifecycleId: null,
    dominantValue: null,
    dominantLabel: null,
    distribution: [],
    sourceCount,
    populatedCount: 3,
    duplicateCount: 0,
    ...(value != null && value > 1000 ? { currencyCode: 'USD' } : {})
  })),
  legend: emptyLegend
});

let latest:
  | { byId: Map<string, CapabilityTableRollup>; isLoading: boolean; error: Error | null }
  | undefined;

const Harness = ({
  capabilities,
  edges = []
}: {
  capabilities: EntityRecord[];
  edges?: { parentId: string; childId: string }[];
}) => {
  latest = useCapabilityRollups(
    'ws-1',
    'business_capability',
    'business-capability-supports-entity-rel',
    capabilities,
    ROLLUPS,
    edges
  );
  return null;
};

describe('useCapabilityRollups', () => {
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
      ({
        body
      }: {
        body: {
          boxEntityIds: string[];
          metric: { source: { fieldId: string }; sourceContext?: string; aggregation: string };
        };
      }) => {
        const { fieldId } = body.metric.source;
        const values = Object.fromEntries(body.boxEntityIds.map(id => [id, 0]));
        if (body.metric.sourceContext === 'relation') {
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 3, 'cap-2': 0 }));
        }
        if (fieldId === 'maturity')
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 3, 'cap-2': 2 }));
        if (fieldId === 'maturity_target')
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 4, 'cap-2': 4 }));
        if (fieldId === 'gap')
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 1, 'cap-2': 2 }));
        if (fieldId === 'risk')
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 2, 'cap-2': 1 }));
        if (fieldId === 'annual_investment') {
          return Promise.resolve(resultsFor({ ...values, 'cap-1': 150000, 'cap-2': 50000 }));
        }
        return Promise.resolve(resultsFor(values));
      }
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('batches every id into one request per metric and keys the result by id', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness capabilities={[capability('cap-1'), capability('cap-2')]} />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && latest?.isLoading !== false; i++) {
      await flush();
    }

    expect(latest?.byId.get('cap-1')).toMatchObject({
      values: { maturity: 3, maturity_target: 4, gap: 1, risk: 2, annual_investment: 150000 },
      currency: { annual_investment: 'USD' },
      appsCount: 3
    });
    expect(latest?.byId.get('cap-2')).toMatchObject({
      values: { maturity: 2, maturity_target: 4, gap: 2, risk: 1, annual_investment: 50000 },
      appsCount: 0
    });
    expect(latest?.isLoading).toBe(false);
    expect(latest?.error).toBeNull();
    // One request per metric (maturity, maturity_target, gap, risk, annual_investment, apps),
    // regardless of how many ids are being rolled up.
    expect(mocks.rollup).toHaveBeenCalledTimes(6);
    for (const call of mocks.rollup.mock.calls) {
      expect(call[0].body.boxEntityIds).toEqual(['cap-1', 'cap-2']);
    }

    // Regression test: the apps-count metric must be keyed by the real, per-workspace relation
    // schema id (passed into the hook), not the schema template's own symId string
    // ('business-capability-supports-entity') — the metrics engine looks up the relation schema
    // by this id, and a symId string matches nothing, silently returning zero terminals.
    const appsCall = mocks.rollup.mock.calls.find(
      call => call[0].body.metric.sourceContext === 'relation'
    );
    expect(appsCall?.[0].body.metric.sourceSchemaId).toBe(
      'business-capability-supports-entity-rel'
    );
    expect(appsCall?.[0].body.metric.path?.[0]?.relationSchemaId).toBe(
      'business-capability-supports-entity-rel'
    );
  });

  it("falls back to a leaf capability's own field values when it has no children", async () => {
    // sourceCount 0 mirrors the metrics engine excluding the box entity from its own subtree
    // walk — a capability with no children has zero matching descendants, so the roll-up should
    // fall back to the capability's own directly-set fields instead of showing "no data".
    mocks.rollup.mockImplementation(
      ({
        body
      }: {
        body: {
          boxEntityIds: string[];
          metric: { source: { fieldId: string }; sourceContext?: string };
        };
      }) => {
        const nulls = Object.fromEntries(body.boxEntityIds.map(id => [id, null]));
        return Promise.resolve(resultsFor(nulls, 0));
      }
    );

    const leaf = capability('cap-3', {
      maturity: 4,
      maturity_target: 5,
      risk: 2,
      gap: 1,
      annual_investment: { amount: 75000, currency: 'EUR' }
    } as Partial<EntityRecord>);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness capabilities={[leaf]} />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && latest?.isLoading !== false; i++) {
      await flush();
    }

    expect(latest?.byId.get('cap-3')).toMatchObject({
      values: { maturity: 4, maturity_target: 5, gap: 1, risk: 2, annual_investment: 75000 },
      currency: { annual_investment: 'EUR' }
    });
  });

  it('rolls appsCount up over the containment subtree (path metric is not subtree-expanded)', async () => {
    mocks.rollup.mockImplementation(
      ({ body }: { body: { boxEntityIds: string[]; metric: { sourceContext?: string } } }) => {
        const values = Object.fromEntries(body.boxEntityIds.map(id => [id, 0]));
        if (body.metric.sourceContext === 'relation') {
          // Raw per-box counts: only the leaves link applications directly.
          return Promise.resolve(resultsFor({ ...values, 'cap-2': 2, 'cap-3': 3 }));
        }
        return Promise.resolve(resultsFor(values));
      }
    );

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness
            capabilities={[capability('cap-1'), capability('cap-2'), capability('cap-3')]}
            edges={[
              { parentId: 'cap-1', childId: 'cap-2' },
              { parentId: 'cap-2', childId: 'cap-3' }
            ]}
          />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && latest?.isLoading !== false; i++) {
      await flush();
    }

    expect(latest?.byId.get('cap-1')?.appsCount).toBe(5);
    expect(latest?.byId.get('cap-2')?.appsCount).toBe(5);
    expect(latest?.byId.get('cap-3')?.appsCount).toBe(3);
  });

  it('returns an empty map and skips requests when there are no capabilities', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness capabilities={[]} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(latest?.byId.size).toBe(0);
    expect(mocks.rollup).not.toHaveBeenCalled();
  });
});
