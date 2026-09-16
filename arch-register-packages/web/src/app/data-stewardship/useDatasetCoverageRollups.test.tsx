// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatasetCoverageRollups, type DatasetCoverageRollups } from './useDatasetCoverageRollups';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { list: mocks.list } }
}));

const entity = (uid: string, overrides: Record<string, unknown> = {}) => ({
  _uid: uid,
  _publicId: `DS-${uid}`,
  _name: `Dataset ${uid}`,
  _schema: { id: 'data-entity', name: 'Data Entity' },
  _owner: { id: 'team-1', name: 'Payments' },
  _lifecycle: null,
  steward: { principal_type: 'user', principal_id: 'user-1' },
  classification: 'confidential',
  review_status: 'current',
  ...overrides
});

let latest: DatasetCoverageRollups | undefined;

const Harness = ({ dataEntitySchemaId }: { dataEntitySchemaId: string | null }) => {
  latest = useDatasetCoverageRollups('ws-1', dataEntitySchemaId);
  return null;
};

describe('useDatasetCoverageRollups', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.list.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (dataEntitySchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness dataEntitySchemaId={dataEntitySchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no data entity schema id)', () => {
    render(null);
    expect(latest).toEqual({ byId: new Map(), summary: [], isLoading: false, error: null });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('computes per-dataset coverage and an "All datasets" summary bucket', async () => {
    mocks.list.mockResolvedValue({
      items: [entity('ds-1'), entity('ds-2', { steward: null })],
      total: 2
    });
    render('data-entity-schema');
    await flush();

    expect(latest?.byId.get('ds-1')).toEqual({ dsCovered: true, dsGaps: [] });
    expect(latest?.byId.get('ds-2')).toEqual({ dsCovered: false, dsGaps: ['no-steward'] });
    expect(latest?.summary).toEqual([{ domain: 'All datasets', covered: 1, total: 2 }]);

    const [request] = mocks.list.mock.calls[0]!;
    expect(request.query._schemaId).toBe('data-entity-schema');
  });

  it('surfaces a query error', async () => {
    mocks.list.mockRejectedValue(new Error('boom'));
    render('data-entity-schema');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
