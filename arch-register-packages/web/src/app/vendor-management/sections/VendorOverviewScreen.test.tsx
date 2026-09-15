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

const today = () => {
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
          security_risk: 5,
          concentration_risk: 5,
          financial_risk: 5,
          compliance_risk: 5,
          criticality: 5
        },
        {
          _uid: 'vnd-2',
          _publicId: 'VND-002',
          _name: 'Beta Supplies',
          security_risk: 1,
          concentration_risk: 1,
          financial_risk: 1,
          compliance_risk: 1,
          criticality: 1
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
        { _uid: 'ctr-1', _publicId: 'CTR-1', _name: 'Acme Support', contract_end: today() }
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

  it('shows the renewals-due, spend, and risk tolerance tiles', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Renewals due');
    expect(container.textContent).toContain('Spend');
    expect(container.textContent).toContain('Above risk tolerance');
    // vnd-1 is high risk (all dimensions 5, criticality 5)
    expect(container.textContent).toContain('1');
  });

  it('lists the upcoming contract in the next renewals table', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Next renewals');
    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).toContain('Acme Corp');
  });

  it('navigates to the Contracts section when a renewal bucket is clicked', async () => {
    await renderScreen();
    const legendButton = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Next 30 days')
    );
    expect(legendButton).toBeDefined();
    await act(async () => {
      legendButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/vendor-management/contracts' })
    );
  });

  it('navigates to the Spend section when its tile is clicked', async () => {
    await renderScreen();
    const spendTile = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('annualised')
    );
    expect(spendTile).toBeDefined();
    await act(async () => {
      spendTile!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/vendor-management/spend' })
    );
  });

  it('navigates to the Risk section when the above-tolerance tile is clicked', async () => {
    await renderScreen();
    const riskTile = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Above risk tolerance')
    );
    expect(riskTile).toBeDefined();
    await act(async () => {
      riskTile!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
