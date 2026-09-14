// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VendorManagementSidebar } from './VendorManagementSidebar';
import {
  VENDOR_CONTRACTS_ID,
  VENDOR_OVERVIEW_ID,
  VENDOR_RISK_ID,
  VENDOR_SPEND_ID,
  VENDOR_VENDORS_ID
} from '../vendorManagementSections';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  schemaList: vi.fn(),
  metricsRollup: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, tree: mocks.entityTree },
    schemas: { list: mocks.schemaList },
    metrics: { rollup: mocks.metricsRollup },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const validConfig = [
  {
    type: 'vendor-management',
    valid: true,
    bindings: {
      vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
      contract: { target: { kind: 'entity_schema', id: 'contract' } }
    }
  }
];

describe('VendorManagementSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

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
    mocks.search = {};

    mocks.capabilityConfigurationsList.mockResolvedValue(validConfig);
    mocks.schemaList.mockResolvedValue([
      {
        id: 'vendor',
        name: 'Vendor',
        icon: 'building',
        color: null,
        fields: [
          {
            id: 'tier',
            name: 'Tier',
            type: 'select',
            options: [
              { value: 'strategic', label: 'Strategic' },
              { value: 'tactical', label: 'Tactical' }
            ]
          },
          {
            id: 'category',
            name: 'Category',
            type: 'select',
            options: [{ value: 'software', label: 'Software' }]
          },
          {
            id: 'cost_centre',
            name: 'Cost Centre',
            type: 'select',
            options: [
              { value: 'cc-eng', label: 'Engineering' },
              { value: 'cc-sales', label: 'Sales' }
            ]
          }
        ]
      },
      {
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
      }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'vnd-1',
          _publicId: 'VND-1',
          _name: 'Acme Corp',
          tier: 'strategic',
          category: 'software',
          relationship_owner: 'Jane Doe'
        },
        {
          _uid: 'vnd-2',
          _publicId: 'VND-2',
          _name: 'Beta Inc',
          tier: 'tactical',
          category: 'software',
          relationship_owner: 'Jane Doe'
        }
      ],
      total: 2
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'vnd-1', _name: 'Acme Corp' },
        {
          _uid: 'ctr-1',
          _name: 'Acme Support',
          contract_type: 'licence',
          contract_end: '2026-10-01'
        }
      ],
      edges: [{ parentId: 'vnd-1', childId: 'ctr-1' }]
    });
    mocks.metricsRollup.mockResolvedValue({
      results: [
        { boxEntityId: 'vnd-1', value: 3000, currencyCode: 'USD', sourceCount: 1 },
        { boxEntityId: 'vnd-2', value: 1000, currencyCode: 'USD', sourceCount: 1 }
      ],
      legend: { min: null, max: null }
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

  it('shows the section nav list for a non-Vendors/Contracts/Spend/Risk section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_OVERVIEW_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('Sections');
    expect(container.textContent).toContain('Vendors');
    expect(container.textContent).not.toContain('Tier');
  });

  it('shows the Band facet and the always-present Technology EOL group for the Risk section', async () => {
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'vnd-1',
          _publicId: 'VND-1',
          _name: 'Acme Corp',
          tier: 'strategic',
          criticality: 5,
          security_risk: 5,
          concentration_risk: 5,
          financial_risk: 5,
          compliance_risk: 5
        },
        {
          _uid: 'vnd-2',
          _publicId: 'VND-2',
          _name: 'Beta Inc',
          tier: 'tactical',
          criticality: 2,
          security_risk: 1,
          concentration_risk: 1,
          financial_risk: 1,
          compliance_risk: 1
        }
      ],
      total: 2
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_RISK_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('Band');
    // Acme Corp (all-5s, criticality 5) bands 'high'; Beta Inc (all-1s, criticality 2) bands
    // 'low' — each should show a count of 1 next to its band label.
    expect(container.textContent).toContain('High');
    expect(container.textContent).toContain('Low');
    expect(container.textContent).not.toContain('Criticality');
    // The design reference always renders the "Technology EOL" group label, even with no
    // exposure data (the `technologyRelease` capability binding isn't configured in this test) —
    // it shouldn't disappear entirely, just show its own empty state.
    expect(container.textContent).toContain('Technology EOL');
    expect(container.textContent).toContain('No technology end-of-life exposure found.');
  });

  it('shows cost centre spend and owner facets for the Spend section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_SPEND_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('All cost centres');
    expect(container.textContent).toContain('Engineering');
    expect(container.textContent).toContain('Sales');
    expect(container.textContent).toContain('Owner');
    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toMatch(/4,000|4000/); // total spend across both vendors
  });

  it('shows renewal window/type/vendor facets with counts for the Contracts section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_CONTRACTS_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('All contracts');
    expect(container.textContent).toContain('Next 30 days');
    expect(container.textContent).toContain('Licence');
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).not.toContain('Sections');

    const row = container.querySelector('[data-testid="contract-facet-type-licence"]');
    expect(row?.textContent).toContain('1');
  });

  it('toggles the contract type facet on click', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_CONTRACTS_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    const row = container.querySelector('[data-testid="contract-facet-type-licence"]');
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const call = mocks.navigate.mock.calls.find(([arg]) => typeof arg?.search === 'function');
    expect(call![0].search({})).toEqual(expect.objectContaining({ type: 'licence' }));
  });

  it('shows tier/category/owner facets with counts for the Vendors section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_VENDORS_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('All vendors');
    expect(container.textContent).toContain('Strategic');
    expect(container.textContent).toContain('Tactical');
    expect(container.textContent).toContain('Software');
    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).not.toContain('Sections');

    const row = container.querySelector('[data-testid="vendor-facet-tier-strategic"]');
    expect(row?.textContent).toContain('1');
  });

  it('toggles the tier facet on click', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_VENDORS_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    const row = container.querySelector('[data-testid="vendor-facet-tier-strategic"]');
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const call = mocks.navigate.mock.calls.find(([arg]) => typeof arg?.search === 'function');
    expect(call![0].search({})).toEqual(expect.objectContaining({ tier: 'strategic' }));
  });
});
