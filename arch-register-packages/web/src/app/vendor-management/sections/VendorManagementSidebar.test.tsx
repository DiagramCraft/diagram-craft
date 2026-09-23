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
          risk: 5,
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
          risk: 1,
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

  it('clicking a Technology EOL item filters instead of navigating to the vendor', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([
      {
        type: 'vendor-management',
        valid: true,
        bindings: {
          vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
          contract: { target: { kind: 'entity_schema', id: 'contract' } },
          technologyRelease: { target: { kind: 'entity_schema', id: 'technology_release' } }
        }
      }
    ]);
    mocks.schemaList.mockResolvedValue([
      { id: 'vendor', name: 'Vendor', fields: [] },
      {
        id: 'contract',
        name: 'Contract',
        fields: [
          {
            id: 'system',
            type: 'typedRelation',
            relationSchemaId: 'system-contract',
            direction: 'out'
          }
        ]
      },
      {
        id: 'component',
        name: 'Component',
        fields: [
          { id: 'system', type: 'containment', schemaId: 'system' },
          { id: 'technology_releases', type: 'reference', schemaId: 'technology_release' }
        ]
      }
    ]);

    const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.projections?.[0]?.alias === 'systems') {
        return {
          items: [
            {
              _uid: 'vnd-1',
              _publicId: 'VND-1',
              _name: 'Acme Corp',
              _projections: { systems: [[hop('con-1', 'contract'), hop('sys-1', 'system')]] }
            }
          ],
          total: 1
        };
      }
      if (entityQuery?.projections?.[0]?.alias === 'tech0') {
        return {
          items: [
            {
              _uid: 'sys-1',
              _projections: {
                tech0: [[hop('cmp-1', 'component'), hop('tr-1', 'technology_release')]]
              }
            }
          ],
          total: 1
        };
      }
      if (entityQuery) {
        // The follow-up id-set lookup (no projections, root op 'in').
        return {
          items: [
            { _uid: 'con-1', _name: 'Contract 1' },
            { _uid: 'sys-1', _name: 'System 1' },
            { _uid: 'tr-1', _name: 'Node 18', eol_date: '2020-01-01T00:00:00.000Z' }
          ],
          total: 3
        };
      }
      // Plain vendor register list (no entityQuery) — used by RiskSidebarContent's own vendor
      // fetch and by the Band facet counts.
      return {
        items: [{ _uid: 'vnd-1', _publicId: 'VND-1', _name: 'Acme Corp', criticality: 5, risk: 5 }],
        total: 1
      };
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_RISK_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    expect(container.textContent).toContain('Node 18');
    const item = [...container.querySelectorAll('[data-testid^="risk-facet-eol-"]')][0];
    expect(item).toBeDefined();

    await act(async () => {
      item!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/risk',
        params: { workspaceSlug: 'ws-1' }
      })
    );
    // The facet patches the `technology` search param on the base Risk route.
  });

  it('lists Technology EOL once per technology (not per vendor), soonest-EOL-first', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([
      {
        type: 'vendor-management',
        valid: true,
        bindings: {
          vendor: { target: { kind: 'entity_schema', id: 'vendor' } },
          contract: { target: { kind: 'entity_schema', id: 'contract' } },
          technologyRelease: { target: { kind: 'entity_schema', id: 'technology_release' } }
        }
      }
    ]);
    mocks.schemaList.mockResolvedValue([
      { id: 'vendor', name: 'Vendor', fields: [] },
      {
        id: 'contract',
        name: 'Contract',
        fields: [
          {
            id: 'system',
            type: 'typedRelation',
            relationSchemaId: 'system-contract',
            direction: 'out'
          }
        ]
      },
      {
        id: 'component',
        name: 'Component',
        fields: [
          { id: 'system', type: 'containment', schemaId: 'system' },
          { id: 'technology_releases', type: 'reference', schemaId: 'technology_release' }
        ]
      }
    ]);

    const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.projections?.[0]?.alias === 'systems') {
        // vnd-1 -> sys-1 (via con-1) and sys-2 (via con-1); vnd-2 -> sys-3 (via con-2).
        return {
          items: [
            {
              _uid: 'vnd-1',
              _publicId: 'VND-1',
              _name: 'Acme Corp',
              _projections: {
                systems: [
                  [hop('con-1', 'contract'), hop('sys-1', 'system')],
                  [hop('con-1', 'contract'), hop('sys-2', 'system')]
                ]
              }
            },
            {
              _uid: 'vnd-2',
              _publicId: 'VND-2',
              _name: 'Beta Inc',
              _projections: { systems: [[hop('con-2', 'contract'), hop('sys-3', 'system')]] }
            }
          ],
          total: 2
        };
      }
      if (entityQuery?.projections?.[0]?.alias === 'tech0') {
        // sys-1 and sys-3 (different vendors) both reach tr-1 — a technology exposed via two
        // vendors. sys-2 reaches tr-2, whose EOL date is earlier.
        return {
          items: [
            {
              _uid: 'sys-1',
              _projections: {
                tech0: [[hop('cmp-1', 'component'), hop('tr-1', 'technology_release')]]
              }
            },
            {
              _uid: 'sys-2',
              _projections: {
                tech0: [[hop('cmp-2', 'component'), hop('tr-2', 'technology_release')]]
              }
            },
            {
              _uid: 'sys-3',
              _projections: {
                tech0: [[hop('cmp-3', 'component'), hop('tr-1', 'technology_release')]]
              }
            }
          ],
          total: 3
        };
      }
      if (entityQuery) {
        // The follow-up id-set lookup (no projections, root op 'in').
        return {
          items: [
            { _uid: 'con-1', _name: 'Contract 1' },
            { _uid: 'con-2', _name: 'Contract 2' },
            { _uid: 'sys-1', _name: 'System 1' },
            { _uid: 'sys-2', _name: 'System 2' },
            { _uid: 'sys-3', _name: 'System 3' },
            { _uid: 'tr-1', _name: 'Node 18', eol_date: '2030-01-01T00:00:00.000Z' },
            { _uid: 'tr-2', _name: 'Java 11', eol_date: '2020-01-01T00:00:00.000Z' }
          ],
          total: 7
        };
      }
      return {
        items: [
          { _uid: 'vnd-1', _publicId: 'VND-1', _name: 'Acme Corp', criticality: 5, risk: 5 },
          { _uid: 'vnd-2', _publicId: 'VND-2', _name: 'Beta Inc', criticality: 3, risk: 1 }
        ],
        total: 2
      };
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VendorManagementSidebar workspaceSlug="ws-1" activeSection={VENDOR_RISK_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    const items = [...container.querySelectorAll('[data-testid^="risk-facet-eol-"]')];
    // tr-1 is reached via two vendors (Acme and Beta) but should appear only once.
    expect(items).toHaveLength(2);
    // Java 11 (2020) EOLs before Node 18 (2030), so it's listed first.
    expect(items[0]?.textContent).toContain('Java 11');
    expect(items[1]?.textContent).toContain('Node 18');
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
