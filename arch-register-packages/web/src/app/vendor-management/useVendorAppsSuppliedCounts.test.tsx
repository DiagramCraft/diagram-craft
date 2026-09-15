// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useVendorAppsSuppliedCounts,
  type VendorAppsSuppliedCounts
} from './useVendorAppsSuppliedCounts';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { list: mocks.list } }
}));

let latest: VendorAppsSuppliedCounts | undefined;

const Harness = ({ vendorIds }: { vendorIds: string[] }) => {
  latest = useVendorAppsSuppliedCounts('ws-1', 'vendor', vendorIds, 'contract', 'system-contract');
  return null;
};

describe('useVendorAppsSuppliedCounts', () => {
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
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('counts distinct systems per vendor, de-duplicating repeated chains to the same system', async () => {
    mocks.list.mockResolvedValue({
      items: [
        {
          _uid: 'vnd-1',
          _projections: {
            systems: [
              [
                { context: 'entity', id: 'ctr-1', schemaId: 'contract' },
                { context: 'entity', id: 'sys-1', schemaId: 'system' }
              ],
              [
                { context: 'entity', id: 'ctr-2', schemaId: 'contract' },
                { context: 'entity', id: 'sys-1', schemaId: 'system' }
              ],
              [
                { context: 'entity', id: 'ctr-2', schemaId: 'contract' },
                { context: 'entity', id: 'sys-2', schemaId: 'system' }
              ]
            ]
          }
        },
        { _uid: 'vnd-2', _projections: { systems: [] } }
      ],
      total: 2
    });
    render(['vnd-1', 'vnd-2']);
    await flush();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(latest?.byId.get('vnd-1')).toBe(2);
    expect(latest?.byId.get('vnd-2')).toBe(0);
  });
});
