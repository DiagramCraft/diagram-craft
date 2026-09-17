// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiOperationsCounts } from './useApiOperationsCounts';

const mocks = vi.hoisted(() => ({ artifactsList: vi.fn(), revisionsList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    artifacts: {
      list: mocks.artifactsList,
      listApiSpecificationRevisions: mocks.revisionsList
    }
  }
}));

const artifact = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  artifactType: 'api-specification',
  status: 'current',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

let latest: ReturnType<typeof useApiOperationsCounts> | undefined;

const Harness = ({ apiIds }: { apiIds: string[] }) => {
  latest = useApiOperationsCounts('ws-1', apiIds);
  return null;
};

describe('useApiOperationsCounts', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.artifactsList.mockReset();
    mocks.revisionsList.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (apiIds: string[]) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness apiIds={apiIds} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns an empty map when there are no API ids', () => {
    render([]);
    expect(latest?.byId.size).toBe(0);
    expect(mocks.artifactsList).not.toHaveBeenCalled();
  });

  it('resolves each API entity’s current revision item count', async () => {
    mocks.artifactsList.mockImplementation(({ params }: { params: { entityId: string } }) =>
      Promise.resolve({
        artifacts: params.entityId === 'api-1' ? [artifact('artifact-1')] : [],
        status: 'current'
      })
    );
    mocks.revisionsList.mockResolvedValue([
      { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 12 }
    ]);

    render(['api-1', 'api-2']);
    await flush();

    expect(latest?.byId.get('api-1')).toBe(12);
    expect(latest?.byId.get('api-2')).toBeNull();
  });
});
