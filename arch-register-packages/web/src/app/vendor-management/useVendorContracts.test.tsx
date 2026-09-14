// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVendorContracts, type VendorContracts } from './useVendorContracts';

const mocks = vi.hoisted(() => ({ tree: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { tree: mocks.tree } }
}));

let latest: VendorContracts | undefined;

const Harness = ({ contractSchemaId }: { contractSchemaId: string | null }) => {
  latest = useVendorContracts('ws-1', contractSchemaId);
  return null;
};

describe('useVendorContracts', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.tree.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (contractSchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness contractSchemaId={contractSchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns no items when there is no bound Contract schema', () => {
    render(null);
    expect(latest?.items).toEqual([]);
    expect(mocks.tree).not.toHaveBeenCalled();
  });

  it("resolves each contract's containing vendor id and name from the tree join", async () => {
    mocks.tree.mockResolvedValue({
      nodes: [
        { _uid: 'vnd-1', _name: 'Acme Corp' },
        { _uid: 'vnd-2', _name: 'Beta Supplies' },
        { _uid: 'ctr-1', _name: 'Acme Support', contract_end: '2099-10-01' },
        { _uid: 'ctr-2', _name: 'Beta Maintenance', contract_end: '2099-06-01' }
      ],
      edges: [
        { parentId: 'vnd-1', childId: 'ctr-1' },
        { parentId: 'vnd-2', childId: 'ctr-2' }
      ]
    });
    render('contract');
    await flush();

    expect(latest?.items).toHaveLength(2);
    const acme = latest?.items.find(row => row.contract._uid === 'ctr-1');
    expect(acme).toEqual(expect.objectContaining({ vendorId: 'vnd-1', vendorName: 'Acme Corp' }));
    const beta = latest?.items.find(row => row.contract._uid === 'ctr-2');
    expect(beta).toEqual(
      expect.objectContaining({ vendorId: 'vnd-2', vendorName: 'Beta Supplies' })
    );
  });

  it('excludes standalone vendor nodes that have no incoming containment edge as a child', async () => {
    mocks.tree.mockResolvedValue({
      nodes: [{ _uid: 'vnd-1', _name: 'Acme Corp' }],
      edges: []
    });
    render('contract');
    await flush();

    expect(latest?.items).toEqual([]);
  });
});
