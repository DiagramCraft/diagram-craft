// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorRiskScreen } from './VendorRiskScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  openEntityDrawer: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  entityTree: vi.fn(),
  schemasList: vi.fn(),
  metricsRollup: vi.fn(),
  lifecycleStatesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../sections/entities/entityDrawer/useEntityDrawer', () => ({
  useEntityDrawer: () => ({ openEntityDrawer: mocks.openEntityDrawer })
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

describe('VendorRiskScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorRiskScreen />
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
          tier: 'tactical',
          security_risk: 1,
          concentration_risk: 1,
          financial_risk: 1,
          compliance_risk: 1,
          criticality: 1
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
      results: [],
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

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Vendor management is not enabled.');
  });

  it('lists vendors in the risk register, sorted by risk descending by default', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).toContain('Beta Supplies');

    const rows = [...container.querySelectorAll('tbody tr')];
    // The first Table.Root is the risk register (the matrix isn't a <table>).
    expect(rows[0]?.textContent).toContain('Acme Corp');
  });

  it('renders the criticality × risk-band matrix with a vendor tag in the scored cell', async () => {
    await renderScreen();
    // Acme Corp (all-5s, criticality 5) bands 'high' -> its tag sits in the matrix's
    // criticality-5/high cell. Table.NameCell renders a <td>, not a <button>, so a <button> with
    // this exact text is unique to the matrix.
    const tag = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Acme Corp'
    );
    expect(tag).toBeDefined();
  });

  it('clicking a matrix vendor tag opens that vendor', async () => {
    await renderScreen();
    const tag = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Acme Corp'
    );
    await act(async () => {
      tag!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.openEntityDrawer).toHaveBeenCalledWith('VND-001');
  });

  it('opens the vendor drawer on a risk register row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tbody tr')].find(tr =>
      tr.textContent?.includes('Acme Corp')
    );
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.openEntityDrawer).toHaveBeenCalledWith('VND-001');
  });

  it('hides the EOL panel entirely when no Technology Release schema is bound', async () => {
    await renderScreen();
    expect(container.textContent).not.toContain('Technology end-of-life');
    expect(container.textContent).not.toContain('Bind a Technology Release entity schema');
  });

  it('filters the register and matrix to the band set by the sidebar', async () => {
    mocks.search = { band: 'high' };
    await renderScreen();

    // Acme Corp (all-5s, criticality 5) bands 'high'; Beta Supplies (all-1s, criticality 1)
    // bands 'low' — only Acme should remain in the register table and the matrix.
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).not.toContain('Beta Supplies');

    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(1);

    const matrixTag = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Beta Supplies'
    );
    expect(matrixTag).toBeUndefined();
  });
});
