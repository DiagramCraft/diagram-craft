// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatasetCoverageRollup, type DatasetCoverageRollup } from './useDatasetCoverageRollup';

const mocks = vi.hoisted(() => ({ entityGet: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { get: mocks.entityGet } }
}));

const entity = (overrides: Record<string, unknown> = {}) => ({
  _uid: 'ds-1',
  _publicId: 'DS-001',
  _name: 'Customer Records',
  _schema: { id: 'data-entity', name: 'Data Entity' },
  _owner: { id: 'team-1', name: 'Payments' },
  _lifecycle: null,
  steward: { principal_type: 'user', principal_id: 'user-1' },
  classification: 'confidential',
  review_status: 'current',
  ...overrides
});

let latest: DatasetCoverageRollup | undefined;

const Harness = ({ datasetId }: { datasetId: string | null }) => {
  latest = useDatasetCoverageRollup('ws-1', datasetId);
  return null;
};

describe('useDatasetCoverageRollup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.entityGet.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (datasetId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness datasetId={datasetId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no datasetId)', () => {
    render(null);
    expect(latest).toEqual({
      dsCovered: false,
      dsGaps: [],
      entity: undefined,
      isLoading: false,
      error: null
    });
    expect(mocks.entityGet).not.toHaveBeenCalled();
  });

  it('resolves dsCovered/dsGaps from the dataset entity record', async () => {
    mocks.entityGet.mockResolvedValue(entity());
    render('ds-1');
    await flush();

    expect(latest?.dsCovered).toBe(true);
    expect(latest?.dsGaps).toEqual([]);
    expect(latest?.entity?._name).toBe('Customer Records');
  });

  it('surfaces gaps for missing fields', async () => {
    mocks.entityGet.mockResolvedValue(entity({ steward: null, review_status: 'overdue' }));
    render('ds-1');
    await flush();

    expect(latest?.dsCovered).toBe(false);
    expect(latest?.dsGaps).toEqual(['no-steward', 'review-not-current']);
  });

  it('surfaces a query error', async () => {
    mocks.entityGet.mockRejectedValue(new Error('boom'));
    render('ds-1');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
