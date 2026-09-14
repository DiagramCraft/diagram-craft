// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVendorAppsSupplied, type VendorAppsSupplied } from './useVendorAppsSupplied';

const mocks = vi.hoisted(() => ({ entityList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { list: mocks.entityList } }
}));

const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });

let latest: VendorAppsSupplied | undefined;

const Harness = () => {
  latest = useVendorAppsSupplied('ws-1', 'vendor', 'vnd-1', 'contract', 'system-contract-rel');
  return null;
};

describe('useVendorAppsSupplied', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.entityList.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('unions the systems reached via the vendor\'s contracts, with contract provenance', async () => {
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.root?.fieldId === '_id' && entityQuery.root.op === 'equals') {
        // The projection query for the vendor itself.
        return {
          items: [
            {
              _uid: 'vnd-1',
              _projections: {
                systems: [
                  [hop('con-1', 'contract'), hop('sys-1', 'system')],
                  [hop('con-2', 'contract'), hop('sys-2', 'system')]
                ]
              }
            }
          ],
          total: 1
        };
      }
      // The follow-up id-set lookup.
      return {
        items: [
          { _uid: 'con-1', _name: 'Contract 1', _publicId: 'CON-1' },
          { _uid: 'con-2', _name: 'Contract 2', _publicId: 'CON-2' },
          { _uid: 'sys-1', _name: 'System 1', _publicId: 'SYS-1' },
          { _uid: 'sys-2', _name: 'System 2', _publicId: 'SYS-2' }
        ],
        total: 4
      };
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.items).toHaveLength(2);
    const bySystem = new Map(latest!.items.map(item => [item.system._uid, item]));
    expect(bySystem.get('sys-1')?.contract._uid).toBe('con-1');
    expect(bySystem.get('sys-2')?.contract._uid).toBe('con-2');
  });

  it('de-duplicates a system reached via more than one contract, keeping the first provenance', async () => {
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.root?.fieldId === '_id' && entityQuery.root.op === 'equals') {
        return {
          items: [
            {
              _uid: 'vnd-1',
              _projections: {
                systems: [
                  [hop('con-1', 'contract'), hop('sys-1', 'system')],
                  [hop('con-2', 'contract'), hop('sys-1', 'system')]
                ]
              }
            }
          ],
          total: 1
        };
      }
      return {
        items: [
          { _uid: 'con-1', _name: 'Contract 1', _publicId: 'CON-1' },
          { _uid: 'con-2', _name: 'Contract 2', _publicId: 'CON-2' },
          { _uid: 'sys-1', _name: 'System 1', _publicId: 'SYS-1' }
        ],
        total: 3
      };
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.items).toHaveLength(1);
    expect(latest?.items[0]?.contract._uid).toBe('con-1');
  });
});
