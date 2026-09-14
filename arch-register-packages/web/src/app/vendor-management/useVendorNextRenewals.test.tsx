// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextRenewalDate, useVendorNextRenewals, type VendorNextRenewals } from './useVendorNextRenewals';

const mocks = vi.hoisted(() => ({ tree: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { tree: mocks.tree } }
}));

describe('nextRenewalDate', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  it('picks the earliest contract_end on or after today', () => {
    expect(
      nextRenewalDate(
        [{ contract_end: '2026-12-01' }, { contract_end: '2026-10-01' }, { contract_end: '2027-01-01' }],
        today
      )
    ).toBe('2026-10-01');
  });

  it('ignores contracts whose end date has already passed', () => {
    expect(nextRenewalDate([{ contract_end: '2026-01-01' }], today)).toBeNull();
  });

  it('returns null for no contracts, or contracts with no contract_end', () => {
    expect(nextRenewalDate([], today)).toBeNull();
    expect(nextRenewalDate([{ contract_end: null }], today)).toBeNull();
  });

  it("treats today's own date as upcoming", () => {
    expect(nextRenewalDate([{ contract_end: '2026-09-14' }], today)).toBe('2026-09-14');
  });
});

let latest: VendorNextRenewals | undefined;

const Harness = ({ vendorIds }: { vendorIds: string[] }) => {
  latest = useVendorNextRenewals('ws-1', 'contract', vendorIds);
  return null;
};

describe('useVendorNextRenewals', () => {
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
    expect(mocks.tree).not.toHaveBeenCalled();
  });

  it('groups contracts by their parent vendor and picks each one\'s earliest upcoming renewal', async () => {
    mocks.tree.mockResolvedValue({
      nodes: [
        { _uid: 'ctr-1', contract_end: '2099-12-01' },
        { _uid: 'ctr-2', contract_end: '2099-10-01' },
        { _uid: 'ctr-3', contract_end: '2099-06-01' }
      ],
      edges: [
        { parentId: 'vnd-1', childId: 'ctr-1' },
        { parentId: 'vnd-1', childId: 'ctr-2' },
        { parentId: 'vnd-2', childId: 'ctr-3' }
      ]
    });
    render(['vnd-1', 'vnd-2', 'vnd-3']);
    await flush();

    expect(latest?.byId.get('vnd-1')).toBe('2099-10-01');
    expect(latest?.byId.get('vnd-2')).toBe('2099-06-01');
    expect(latest?.byId.get('vnd-3')).toBeNull();
  });
});
