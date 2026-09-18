// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiOperationsFeed, type ApiOperationsFeedRef } from './useApiOperationsFeed';

const mocks = vi.hoisted(() => ({
  artifactsList: vi.fn(),
  revisionsList: vi.fn(),
  apiSpecification: vi.fn()
}));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    artifacts: {
      list: mocks.artifactsList,
      listApiSpecificationRevisions: mocks.revisionsList,
      listApiSpecification: mocks.apiSpecification
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

const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  itemKey: id,
  revisionId: 'rev-1',
  protocol: 'openapi',
  itemKind: 'operation',
  path: '/orders',
  channel: null,
  action: 'get',
  identifier: id,
  declaredIdentifier: null,
  summary: null,
  description: null,
  tags: [],
  deprecated: false,
  parameters: [],
  ...overrides
});

let latest: ReturnType<typeof useApiOperationsFeed> | undefined;

const Harness = ({
  apis,
  filters,
  enabled
}: {
  apis: readonly ApiOperationsFeedRef[];
  filters?: { deprecated?: boolean };
  enabled?: boolean;
}) => {
  latest = useApiOperationsFeed('ws-1', apis, filters, enabled);
  return null;
};

describe('useApiOperationsFeed', () => {
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
    mocks.apiSpecification.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (props: {
    apis: readonly ApiOperationsFeedRef[];
    filters?: { deprecated?: boolean };
    enabled?: boolean;
  }) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness {...props} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns no rows and fires no queries when there are no APIs', async () => {
    render({ apis: [] });
    await flush();
    expect(latest?.rows).toEqual([]);
    expect(mocks.artifactsList).not.toHaveBeenCalled();
  });

  it('returns no rows and fires no queries when disabled', async () => {
    render({ apis: [{ id: 'api-1', publicId: 'API-1', name: 'Orders API' }], enabled: false });
    await flush();
    expect(latest?.rows).toEqual([]);
    expect(mocks.artifactsList).not.toHaveBeenCalled();
  });

  it('flattens items across APIs, tagged with the parent API', async () => {
    mocks.artifactsList.mockImplementation(({ params }: { params: { entityId: string } }) =>
      Promise.resolve({
        artifacts: params.entityId === 'api-1' ? [artifact('artifact-1')] : [],
        status: 'current'
      })
    );
    mocks.revisionsList.mockResolvedValue([
      { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 1 }
    ]);
    mocks.apiSpecification.mockResolvedValue({
      revision: { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 1 },
      items: [item('op-1')],
      total: 1,
      limit: 200,
      offset: 0
    });

    render({
      apis: [
        { id: 'api-1', publicId: 'API-1', name: 'Orders API' },
        { id: 'api-2', publicId: 'API-2', name: 'Payments API' }
      ]
    });
    await flush();

    expect(latest?.rows).toHaveLength(1);
    expect(latest?.rows[0]?.api).toEqual({ id: 'api-1', publicId: 'API-1', name: 'Orders API' });
    expect(latest?.rows[0]?.item.action).toBe('get');
    // api-2 has no artifact, so no query fires for it and it contributes no rows.
  });

  it('forwards the deprecated filter server-side', async () => {
    mocks.artifactsList.mockResolvedValue({
      artifacts: [artifact('artifact-1')],
      status: 'current'
    });
    mocks.revisionsList.mockResolvedValue([
      { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 1 }
    ]);
    mocks.apiSpecification.mockResolvedValue({
      revision: { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 1 },
      items: [item('op-1', { deprecated: true })],
      total: 1,
      limit: 200,
      offset: 0
    });

    render({
      apis: [{ id: 'api-1', publicId: 'API-1', name: 'Orders API' }],
      filters: { deprecated: true }
    });
    await flush();

    expect(mocks.apiSpecification).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ deprecated: true, limit: 200 }) })
    );
    expect(latest?.rows).toHaveLength(1);
  });
});
