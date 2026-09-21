// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskComplianceRisksScreen } from './RiskComplianceRisksScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationsList: vi.fn(),
  relationsListForEntity: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string; riskId?: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    relations: { list: mocks.relationsList, listForEntity: mocks.relationsListForEntity },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: ({ entityId }: { entityId: string }) =>
    createElement('div', null, `Open record in Entities ${entityId}`)
}));

const CONFIG = {
  type: 'risk-compliance',
  valid: true,
  bindings: {
    risk: { target: { kind: 'entity_schema', id: 'risk' } },
    control: { target: { kind: 'entity_schema', id: 'control' } }
  }
};

describe('RiskComplianceRisksScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskComplianceRisksScreen />
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
          _uid: 'risk-1',
          _publicId: 'RSK-001',
          _name: 'Customer Account Takeover',
          category: 'security',
          likelihood: 3,
          impact: 3,
          inherent_risk_score: 9,
          residual_risk_score: 9
        }
      ],
      total: 1
    });
    mocks.entityGet.mockResolvedValue({
      _uid: 'risk-1',
      _publicId: 'RSK-001',
      _name: 'Customer Account Takeover',
      _schema: { id: 'risk', name: 'Risk' },
      _owner: null,
      _lifecycle: null
    });
    mocks.schemasList.mockResolvedValue([
      {
        id: 'risk',
        name: 'Risk',
        fields: [
          {
            id: 'mitigating_controls',
            type: 'typedRelation',
            relationSchemaId: 'risk-control'
          }
        ]
      }
    ]);
    mocks.relationsList.mockResolvedValue({ items: [], total: 0 });
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists risks with a residual risk band and opens the drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Customer Account Takeover');
    expect(container.textContent).toContain('RSK-001');
    expect(container.textContent).toContain('medium');

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer Account Takeover')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/risk-compliance/risks/$riskId',
        params: { workspaceSlug: 'ws-1', riskId: 'RSK-001' }
      })
    );
  });

  it('renders the drawer when the route carries a riskId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', riskId: 'risk-1' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Risk & Compliance is not enabled.');
  });
});
