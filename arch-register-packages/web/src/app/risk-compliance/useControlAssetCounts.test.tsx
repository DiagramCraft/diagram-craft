// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useControlAssetCounts, type ControlAssetCounts } from './useControlAssetCounts';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.list } }
}));

const relation = (controlId: string, assetId: string) => ({
  _uid: `rel-${controlId}-${assetId}`,
  _schema: { id: 'control-affects-schema', name: 'Control Protection' },
  _in: { id: controlId, name: `Control ${controlId}`, schemaId: 'control-schema' },
  _out: { id: assetId, name: `Asset ${assetId}`, schemaId: 'entity-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true
});

let latest: ControlAssetCounts | undefined;

const Harness = ({ relationSchemaId }: { relationSchemaId: string | null }) => {
  latest = useControlAssetCounts('ws-1', relationSchemaId);
  return null;
};

describe('useControlAssetCounts', () => {
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

  const render = (relationSchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness relationSchemaId={relationSchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no relation schema id)', () => {
    render(null);
    expect(latest).toEqual({ countById: new Map(), isLoading: false, error: null });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('counts control-affects relations per protecting Control id', async () => {
    mocks.list.mockResolvedValue({
      items: [
        relation('control-1', 'asset-1'),
        relation('control-1', 'asset-2'),
        relation('control-2', 'asset-1')
      ],
      total: 3
    });
    render('control-affects-schema');
    await flush();

    expect(latest?.countById.get('control-1')).toBe(2);
    expect(latest?.countById.get('control-2')).toBe(1);
    expect(latest?.countById.has('control-3')).toBe(false);
  });

  it('surfaces a query error', async () => {
    mocks.list.mockRejectedValue(new Error('boom'));
    render('control-affects-schema');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
