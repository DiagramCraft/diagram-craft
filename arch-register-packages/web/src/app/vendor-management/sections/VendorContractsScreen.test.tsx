// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorContractsScreen } from './VendorContractsScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityTree: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string; contractId?: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { tree: mocks.entityTree, get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: () => <div>Open record in Entities</div>
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
  icon: 'certificate',
  color: null,
  fields: [
    {
      id: 'contract_type',
      name: 'Contract Type',
      type: 'select',
      options: [
        { value: 'licence', label: 'Licence' },
        { value: 'support', label: 'Support' }
      ]
    }
  ]
};

describe('VendorContractsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorContractsScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-14T00:00:00Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.params = { workspaceSlug: 'ws-1' };
    mocks.search = {};
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.schemasList.mockResolvedValue([CONTRACT_SCHEMA]);
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'vnd-1', _publicId: 'VND-1', _name: 'Acme Corp' },
        { _uid: 'vnd-2', _publicId: 'VND-2', _name: 'Beta Supplies' },
        {
          _uid: 'ctr-1',
          _publicId: 'CTR-1',
          _name: 'Acme Support',
          contract_type: 'licence',
          contract_start: '2025-10-01',
          contract_end: '2026-10-01',
          annual_cost: { amount: 1000, currency: 'USD' },
          auto_renew: true,
          notice_period_days: 30
        },
        {
          _uid: 'ctr-2',
          _publicId: 'CTR-2',
          _name: 'Beta Maintenance',
          contract_type: 'support',
          contract_start: '2025-09-01',
          contract_end: '2026-09-01',
          annual_cost: { amount: 500, currency: 'USD' },
          auto_renew: false
        }
      ],
      edges: [
        { parentId: 'vnd-1', childId: 'ctr-1' },
        { parentId: 'vnd-2', childId: 'ctr-2' }
      ]
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('lists contracts with vendor name, type, and renewal date', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).toContain('Licence');
    expect(container.textContent).toContain('Beta Maintenance');
  });

  it('opens the contract drawer on row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Acme Support')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/contracts/$contractId',
        params: { workspaceSlug: 'ws-1', contractId: 'CTR-1' }
      })
    );
  });

  it('renders the drawer when the route carries a contractId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', contractId: 'ctr-1' };
    mocks.entityGet.mockResolvedValue({
      _uid: 'ctr-1',
      _publicId: 'CTR-1',
      _name: 'Acme Support',
      contract_type: 'licence',
      contract_end: '2026-10-01'
    });
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
    expect(container.textContent).toContain('Beta Maintenance');
    expect(container.textContent).not.toContain('Acme Support');
  });

  it('filters rows by the type facet search param', async () => {
    mocks.search = { type: 'support' };
    await renderScreen();
    expect(container.textContent).toContain('Beta Maintenance');
    expect(container.textContent).not.toContain('Acme Support');
  });

  it('filters rows by the vendor facet search param', async () => {
    mocks.search = { vendor: 'vnd-1' };
    await renderScreen();
    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).not.toContain('Beta Maintenance');
  });

  it('filters rows by the renewalWindow facet search param', async () => {
    mocks.search = { renewalWindow: 'overdue' };
    await renderScreen();
    expect(container.textContent).toContain('Beta Maintenance');
    expect(container.textContent).not.toContain('Acme Support');
  });

  it('switches to the calendar view', async () => {
    mocks.search = { view: 'calendar' };
    await renderScreen();
    expect(container.textContent).toContain('Acme Support');
    expect(container.querySelector('table')).toBeNull();
  });

  it('renders the view switcher as a segmented control, not a dropdown, and switches on click', async () => {
    await renderScreen();
    const calendarButton = [...container.querySelectorAll('button')].find(
      btn => btn.textContent === 'Renewal calendar'
    );
    expect(calendarButton).toBeDefined();

    await act(async () => {
      calendarButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 3; i++) await flush();

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/contracts',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('switches to the timeline view', async () => {
    mocks.search = { view: 'timeline' };
    await renderScreen();
    expect(container.textContent).toContain('Acme Support');
    expect(container.querySelector('table')).toBeNull();
    const bar = [...container.querySelectorAll('button')].find(btn =>
      btn.title?.includes('Acme Support')
    );
    expect(bar).toBeDefined();
  });
});
