// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorSpendScreen } from './VendorSpendScreen';

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: () => <div>Open record in Entities</div>
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  metricsRollup: vi.fn(),
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
    entities: { list: mocks.entityList, tree: mocks.entityTree, get: mocks.entityGet },
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

const VENDOR_SCHEMA = {
  id: 'vendor',
  name: 'Vendor',
  icon: 'building',
  color: null,
  fields: [
    {
      id: 'cost_centre',
      name: 'Cost Centre',
      type: 'select',
      options: [
        { value: 'engineering', label: 'Engineering' },
        { value: 'sales', label: 'Sales' }
      ]
    }
  ]
};

describe('VendorSpendScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorSpendScreen />
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
    mocks.schemasList.mockResolvedValue([VENDOR_SCHEMA]);
    mocks.entityList.mockResolvedValue({
      items: [
        { _uid: 'vnd-1', _publicId: 'VND-001', _name: 'Acme Corp', cost_centre: 'engineering' },
        { _uid: 'vnd-2', _publicId: 'VND-002', _name: 'Beta Supplies', cost_centre: 'sales' }
      ],
      total: 2
    });
    mocks.metricsRollup.mockResolvedValue({
      results: [
        {
          boxEntityId: 'vnd-1',
          value: 3000,
          currencyCode: 'USD',
          sourceCount: 2
        },
        {
          boxEntityId: 'vnd-2',
          value: 1000,
          currencyCode: 'USD',
          sourceCount: 1
        }
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
          annual_cost: { amount: 2000, currency: 'USD' },
          auto_renew: true
        },
        {
          _uid: 'ctr-2',
          _publicId: 'CTR-2',
          _name: 'Acme Licence',
          annual_cost: { amount: 1000, currency: 'USD' },
          auto_renew: false
        },
        {
          _uid: 'ctr-3',
          _publicId: 'CTR-3',
          _name: 'Beta Services',
          annual_cost: { amount: 1000, currency: 'USD' },
          auto_renew: true
        }
      ],
      edges: [
        { parentId: 'vnd-1', childId: 'ctr-1' },
        { parentId: 'vnd-1', childId: 'ctr-2' },
        { parentId: 'vnd-2', childId: 'ctr-3' }
      ]
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists vendors with their spend share, sorted descending', async () => {
    await renderScreen();
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows[0]?.textContent).toContain('Acme Corp');
    expect(rows[1]?.textContent).toContain('Beta Supplies');
    expect(container.textContent).toContain('75.0%');
    expect(container.textContent).toContain('25.0%');
  });

  it('shows the portfolio total in the header', async () => {
    await renderScreen();
    expect(container.textContent).toMatch(/4,000|4000/);
  });

  it('opens the vendor drawer in place (not the Vendors section) on row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Acme Corp')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/spend/$vendorId',
        params: { workspaceSlug: 'ws-1', vendorId: 'VND-001' }
      })
    );
  });

  it('renders the drawer in place when the route carries a vendorId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', vendorId: 'VND-001' };
    mocks.entityGet.mockResolvedValue({
      _uid: 'vnd-1',
      _publicId: 'VND-001',
      _name: 'Acme Corp',
      _schema: { id: 'vendor', name: 'Vendor' },
      _owner: null,
      _lifecycle: null
    });
    await renderScreen();
    // Still on the Spend screen (its own toolbar), with the drawer rendered alongside it.
    expect(container.textContent).toContain('Group by');
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('groups by cost centre when the group search param is set', async () => {
    mocks.search = { group: 'costCentre' };
    await renderScreen();
    expect(container.textContent).toContain('Engineering');
    expect(container.textContent).toContain('Sales');
    expect(container.textContent).not.toContain('Acme Corp');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Vendor management is not enabled.');
  });

  it('shows contract count and largest contract per vendor row', async () => {
    await renderScreen();
    const acmeRow = [...container.querySelectorAll('tbody tr')].find(tr =>
      tr.textContent?.includes('Acme Corp')
    );
    expect(acmeRow?.textContent).toContain('2'); // contract count
    expect(acmeRow?.textContent).toContain('Acme Support'); // largest of its two contracts
  });

  it('shows the header stats — total, fixed-term commitment, strategic tier, cost centres', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Total annualised');
    expect(container.textContent).toContain('Fixed-term commitment');
    // ctr-2 ($1,000) is the only non-auto-renewing contract
    expect(container.textContent).toMatch(/1,000|1000/);
    expect(container.textContent).toContain('Strategic tier');
    expect(container.textContent).toContain('Cost centres');
    expect(container.textContent).toContain('2'); // two cost centres charged
  });

  it('shows an explanatory empty state when grouped by capability', async () => {
    mocks.search = { group: 'capability' };
    await renderScreen();
    expect(container.textContent).toContain('Contract-to-capability schema link');
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows a no-contract-schema empty state when unbound', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([
      {
        ...CONFIG,
        bindings: { vendor: { target: { kind: 'entity_schema', id: 'vendor' } } }
      }
    ]);
    await renderScreen();
    expect(container.textContent).toContain('No Contract entity schema is bound.');
  });
});
