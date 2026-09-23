// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorOverviewScreen } from './VendorOverviewScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  schemasList: vi.fn(),
  metricsRollup: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, tree: mocks.entityTree },
    schemas: { list: mocks.schemasList },
    metrics: { rollup: mocks.metricsRollup },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const CONFIG = {
  type: 'vendor-management',
  valid: true,
  bindings: {
    vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
    contract: { target: { kind: 'entity_schema', id: 'contract' } }
  }
};

const CONTRACT_SCHEMA = {
  id: 'contract',
  name: 'Contract',
  icon: 'file',
  color: null,
  fields: []
};

const VENDOR_SCHEMA = {
  id: 'vendor',
  name: 'Vendor',
  icon: 'building',
  color: null,
  fields: []
};

const soon = () => {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  return date.toISOString().slice(0, 10);
};

describe('VendorOverviewScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorOverviewScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.params = { workspaceSlug: 'ws-1' };
    mocks.search = {};
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.schemasList.mockResolvedValue([VENDOR_SCHEMA, CONTRACT_SCHEMA]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'vnd-1',
          _publicId: 'VND-001',
          _name: 'Acme Corp',
          tier: 'Strategic',
          security_risk: 5,
          concentration_risk: 5,
          financial_risk: 5,
          compliance_risk: 5,
          criticality: 5,
          risk: 5
        },
        {
          _uid: 'vnd-2',
          _publicId: 'VND-002',
          _name: 'Beta Supplies',
          tier: 'Commodity',
          security_risk: 1,
          concentration_risk: 1,
          financial_risk: 1,
          compliance_risk: 1,
          criticality: 1,
          risk: 1
        }
      ],
      total: 2
    });
    mocks.metricsRollup.mockResolvedValue({
      results: [
        { boxEntityId: 'vnd-1', value: 3000, currencyCode: 'USD', sourceCount: 2 },
        { boxEntityId: 'vnd-2', value: 1000, currencyCode: 'USD', sourceCount: 1 }
      ],
      legend: { min: null, max: null }
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'vnd-1', _publicId: 'VND-001', _name: 'Acme Corp' },
        { _uid: 'vnd-2', _publicId: 'VND-002', _name: 'Beta Supplies' },
        {
          _uid: 'ctr-1',
          _publicId: 'CTR-1',
          _name: 'Acme Support',
          contract_end: soon(),
          annual_cost: { amount: 2000, currency: 'USD' },
          auto_renew: true
        }
      ],
      edges: [{ parentId: 'vnd-1', childId: 'ctr-1' }]
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows the four header stats', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Contracted spend');
    expect(container.textContent).toMatch(/4,000|4000/);
    expect(container.textContent).toContain('Renewals in 90 days');
    expect(container.textContent).toContain('Vendors above tolerance');
    expect(container.textContent).toContain('Auto-renewing');
  });

  it('shows the 12-month renewal strip and the next renewals list', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Renewals — next 12 months');
    expect(container.textContent).toContain('Next renewals');
    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).toContain('auto-renews');
    expect(container.textContent).toContain('10d');
  });

  it('shows spend by vendor and vendors-above-tolerance panels', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Spend by vendor');
    expect(container.textContent).toContain('Beta Supplies');
    expect(container.textContent).toContain('Vendors above tolerance');
    // vnd-1 is high risk (all dimensions 5, criticality 5) and appears in the register table
    const table = [...container.querySelectorAll('table')].find(t =>
      t.textContent?.includes('Criticality')
    );
    expect(table?.textContent).toContain('Acme Corp');
    expect(table?.textContent).toContain('Strategic');
  });

  it('shows the technology EOL exposure panel with a not-linked message when unbound', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Technology end-of-life exposure');
    expect(container.textContent).toContain('No Technology Release schema is linked');
  });

  it('shows the footnote linking to Entities', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Entities');
  });

  it('navigates to the Contracts calendar when "Renewal calendar" is clicked', async () => {
    await renderScreen();
    const button = [...container.querySelectorAll('button')].find(
      b => b.textContent === 'Renewal calendar'
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/vendor-management/contracts' })
    );
  });

  it('opens the contract drawer on the Contracts section when a next-renewal row is clicked', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Acme Support')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const call = mocks.navigate.mock.calls.at(-1)?.[0];
    expect(call).toEqual(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/contracts',
        params: { workspaceSlug: 'ws-1' },
        search: expect.any(Function)
      })
    );
    expect(call.search({})).toEqual({ drawer: 'CTR-1' });
  });

  it('opens the vendor drawer on the Spend section when a spend-by-vendor row is clicked', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Beta Supplies')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const call = mocks.navigate.mock.calls.at(-1)?.[0];
    expect(call).toEqual(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/spend',
        params: { workspaceSlug: 'ws-1' },
        search: expect.any(Function)
      })
    );
    expect(call.search({})).toEqual({ drawer: 'VND-002' });
  });

  it('navigates to the Risk section when "Risk view" is clicked', async () => {
    await renderScreen();
    const button = [...container.querySelectorAll('button')].find(
      b => b.textContent === 'Risk view'
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/vendor-management/risk' })
    );
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Vendor management is not enabled.');
  });
});
