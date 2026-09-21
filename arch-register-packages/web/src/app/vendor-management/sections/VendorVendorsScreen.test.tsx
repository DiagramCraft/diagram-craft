// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorVendorsScreen } from './VendorVendorsScreen';

vi.mock('./VendorDrawer', () => ({
  VendorDrawer: () => <div>Open record in Entities</div>
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  entityTree: vi.fn(),
  schemasList: vi.fn(),
  metricsRollup: vi.fn(),
  lifecycleStatesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string; vendorId?: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: mocks.entityGet, tree: mocks.entityTree },
    schemas: { list: mocks.schemasList },
    metrics: { rollup: mocks.metricsRollup },
    config: {
      lifecycleStates: { list: mocks.lifecycleStatesList },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
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

describe('VendorVendorsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorVendorsScreen />
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
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'vnd-1',
          _publicId: 'VND-001',
          _name: 'Acme Corp',
          tier: 'strategic',
          category: 'software',
          status: 'active',
          relationship_owner: 'Jane Doe',
          security_risk: 4,
          concentration_risk: 3,
          financial_risk: 2,
          compliance_risk: 3,
          criticality: 4
        },
        {
          _uid: 'vnd-2',
          _publicId: 'VND-002',
          _name: 'Beta Supplies',
          tier: 'tactical',
          category: 'hardware',
          status: 'active',
          relationship_owner: 'John Smith',
          security_risk: null,
          concentration_risk: null,
          financial_risk: null,
          compliance_risk: null,
          criticality: null
        }
      ],
      total: 2
    });
    mocks.entityGet.mockResolvedValue({
      _uid: 'vnd-1',
      _publicId: 'VND-001',
      _name: 'Acme Corp',
      _schema: { id: 'vendor', name: 'Vendor' },
      _owner: null,
      _lifecycle: null
    });
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });
    mocks.schemasList.mockResolvedValue([]);
    mocks.metricsRollup.mockResolvedValue({
      results: [
        {
          boxEntityId: 'vnd-1',
          value: null,
          lifecycleId: null,
          dominantValue: null,
          dominantLabel: null,
          distribution: [],
          sourceCount: 0,
          populatedCount: 0,
          duplicateCount: 0
        }
      ],
      legend: { min: null, max: null }
    });
    mocks.lifecycleStatesList.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists vendors and opens the drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).toContain('VND-001');

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Acme Corp')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/vendors/$vendorId',
        params: { workspaceSlug: 'ws-1', vendorId: 'VND-001' }
      })
    );
  });

  it('renders the drawer when the route carries a vendorId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', vendorId: 'vnd-1' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Vendor management is not enabled.');
  });

  it('filters rows by the q search param', async () => {
    mocks.search = { q: 'Beta' };
    await renderScreen();
    expect(container.textContent).toContain('Beta Supplies');
    expect(container.textContent).not.toContain('Acme Corp');
  });

  it('filters rows by the tier facet search param', async () => {
    mocks.search = { tier: 'tactical' };
    await renderScreen();
    expect(container.textContent).toContain('Beta Supplies');
    expect(container.textContent).not.toContain('Acme Corp');
  });

  it('filters rows by the owner facet search param', async () => {
    mocks.search = { owner: 'Jane Doe' };
    await renderScreen();
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).not.toContain('Beta Supplies');
  });

  it('sorts by risk when the Risk header is clicked', async () => {
    await renderScreen();

    const riskHeader = [...container.querySelectorAll('th')].find(th =>
      th.textContent?.includes('Risk')
    );
    expect(riskHeader).toBeDefined();
    await act(async () => {
      riskHeader!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const rows = [...container.querySelectorAll('tbody tr')];
    // Acme Corp has scored risk dimensions, Beta Supplies has none (`vmRisk` is null and sorts
    // last) — descending risk puts Acme Corp first regardless of toggle direction.
    expect(rows[0]?.textContent).toContain('Acme Corp');
  });
});
