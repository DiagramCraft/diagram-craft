// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { VendorDrawer } from './VendorDrawer';
import type { VendorManagementConfig } from '../vendorManagementQueries';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityGet: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  schemasList: vi.fn(),
  metricsRollup: vi.fn(),
  lifecycleStatesList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet, list: mocks.entityList, tree: mocks.entityTree },
    schemas: { list: mocks.schemasList },
    metrics: { rollup: mocks.metricsRollup },
    config: { lifecycleStates: { list: mocks.lifecycleStatesList } }
  }
}));

const vendorConfig: VendorManagementConfig = {
  vendorSchemaId: 'vendor',
  contractSchemaId: 'contract',
  technologyReleaseSchemaId: null
};

const emptyRollup: MetricRollupResponse = {
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
};

const vendorSchema = {
  id: 'vendor',
  name: 'Vendor',
  fields: [
    { id: 'security_risk', name: 'Security Risk', type: 'number' },
    { id: 'concentration_risk', name: 'Concentration Risk', type: 'number' },
    { id: 'financial_risk', name: 'Financial Risk', type: 'number' },
    { id: 'compliance_risk', name: 'Compliance Risk', type: 'number' },
    { id: 'criticality', name: 'Criticality', type: 'number' },
    { id: 'category', name: 'Category', type: 'select', options: [] },
    { id: 'tier', name: 'Tier', type: 'select', options: [] },
    { id: 'status', name: 'Status', type: 'select', options: [] },
    { id: 'relationship_owner', name: 'Relationship Owner', type: 'text' },
    { id: 'cost_centre', name: 'Cost Centre', type: 'select', options: [] }
  ]
};

const contractSchema = {
  id: 'contract',
  name: 'Contract',
  fields: [
    {
      id: 'system',
      name: 'Used by',
      type: 'typedRelation',
      relationSchemaId: 'system-contract-rel',
      direction: 'out',
      minCount: 0,
      maxCount: -1
    },
    { id: 'annual_cost', name: 'Annual Cost', type: 'currency' }
  ]
};

describe('VendorDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mocks.entityGet.mockResolvedValue({
      _uid: 'vnd-1',
      _publicId: 'VND-001',
      _name: 'Acme Corp',
      _schema: { id: 'vendor', name: 'Vendor' },
      _owner: null,
      _lifecycle: null,
      category: 'software',
      tier: 'strategic',
      status: 'active',
      relationship_owner: 'Jane Doe',
      cost_centre: 'engineering',
      security_risk: 3,
      concentration_risk: 3,
      financial_risk: 3,
      compliance_risk: 3,
      criticality: 3
    });
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });
    mocks.schemasList.mockResolvedValue([vendorSchema, contractSchema]);
    mocks.metricsRollup.mockResolvedValue(emptyRollup);
    mocks.lifecycleStatesList.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const flushUntilNoLoading = async () => {
    for (let i = 0; i < 8 && container.textContent?.includes('Loading vendor'); i++) {
      await flush();
    }
    for (let i = 0; i < 8; i++) await flush();
  };

  const renderDrawer = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorDrawer
            workspaceSlug="ws-1"
            vendorId="vnd-1"
            vendorConfig={vendorConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    await flushUntilNoLoading();
  };

  it('shows attributes, risk profile, and empty states for a vendor with no contracts', async () => {
    await renderDrawer();

    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).toContain('VND-001');
    expect(container.textContent).toContain('strategic');
    expect(container.textContent).toContain('active');
    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toContain('No contracts.');
    expect(container.textContent).toContain('No linked applications, via any contract.');
    expect(container.textContent).toContain('Not yet available — no linked capability data yet.');
    // All-3s risk profile -> vmRisk = (3-1)/4*100 * criticality-3 lift (1.1) = 55, banded medium.
    expect(container.textContent).toContain('medium');
  });

  it('lists a contract from the entity tree and its annual cost', async () => {
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'vnd-1', _name: 'Acme Corp' },
        {
          _uid: 'con-1',
          _name: 'Support Agreement',
          annual_cost: { amount: 12000, currency: 'USD' }
        }
      ],
      edges: [{ parentId: 'vnd-1', childId: 'con-1' }]
    });
    await renderDrawer();

    expect(container.textContent).toContain('Support Agreement');
    expect(container.textContent).not.toContain('No contracts.');
  });

  it('navigates to the entity detail route when "Open record in Entities" is clicked', async () => {
    await renderDrawer();

    const footerButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Open record in Entities'
    );
    expect(footerButton).toBeDefined();

    await act(async () => {
      footerButton!.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      entityDetailRoute('ws-1', asEntityPublicId('VND-001'))
    );
  });

  it('shows an unavailable state when the vendor fails to load', async () => {
    mocks.entityGet.mockRejectedValue(new Error('not found'));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorDrawer
            workspaceSlug="ws-1"
            vendorId="vnd-1"
            vendorConfig={vendorConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    expect(container.textContent).toContain('This vendor is unavailable.');
  });
});
