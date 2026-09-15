// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskComplianceControlsScreen } from './RiskComplianceControlsScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationsList: vi.fn(),
  relationsListForEntity: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string; controlId?: string },
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

const CONFIG = {
  type: 'risk-compliance',
  valid: true,
  bindings: {
    risk: { target: { kind: 'entity_schema', id: 'risk' } },
    control: { target: { kind: 'entity_schema', id: 'control' } }
  }
};

describe('RiskComplianceControlsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskComplianceControlsScreen />
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
          _uid: 'control-1',
          _publicId: 'CTL-001',
          _name: 'MFA Enforcement',
          control_type: 'preventive',
          operating_effectiveness: 'effective'
        }
      ],
      total: 1
    });
    mocks.entityGet.mockResolvedValue({
      _uid: 'control-1',
      _publicId: 'CTL-001',
      _name: 'MFA Enforcement',
      _schema: { id: 'control', name: 'Control' },
      _owner: null,
      _lifecycle: null
    });
    mocks.schemasList.mockResolvedValue([]);
    mocks.relationsList.mockResolvedValue({ items: [], total: 0 });
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists controls and opens the drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('MFA Enforcement');
    expect(container.textContent).toContain('CTL-001');
    expect(container.textContent).toContain('preventive');

    // Effectiveness renders as a colour-outlined pill (Chip's `color` prop), not plain text.
    const effectivenessPill = [...container.querySelectorAll('span')].find(
      span => span.textContent === 'effective'
    );
    expect(effectivenessPill?.style.borderColor).toBeTruthy();
    expect(effectivenessPill?.style.color).toBeTruthy();

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('MFA Enforcement')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/risk-compliance/controls/$controlId',
        params: { workspaceSlug: 'ws-1', controlId: 'CTL-001' }
      })
    );
  });

  it('renders the drawer when the route carries a controlId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', controlId: 'control-1' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Risk & Compliance is not enabled.');
  });

  it('shows the coverage roll-up view with weakest-covered risks and assets', async () => {
    mocks.search = { view: 'coverage' };
    mocks.schemasList.mockResolvedValue([
      {
        id: 'risk',
        name: 'Risk',
        fields: [
          { id: 'mitigating_controls', type: 'typedRelation', relationSchemaId: 'risk-control' },
          { id: 'affected_entities', type: 'typedRelation', relationSchemaId: 'risk-affects' }
        ]
      },
      {
        id: 'control',
        name: 'Control',
        fields: [
          { id: 'mitigated_risks', type: 'typedRelation', relationSchemaId: 'risk-control' },
          {
            id: 'satisfied_requirements',
            type: 'typedRelation',
            relationSchemaId: 'control-requirement'
          }
        ]
      },
      { id: 'data-store', name: 'Data Store', fields: [] }
    ]);
    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'risk') {
        return Promise.resolve({
          items: [{ _uid: 'risk-1', _publicId: 'RSK-001', _name: 'Account Takeover' }],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    mocks.relationsList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'risk-control') {
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-1',
              _schema: { id: 'risk-control', name: 'Risk Mitigation' },
              _in: { id: 'risk-1', name: 'Account Takeover' },
              _out: { id: 'control-1', name: 'MFA Enforcement' },
              coverage: 50,
              effectiveness: 'partial'
            }
          ],
          total: 1
        });
      }
      if (query.schemaId === 'risk-affects') {
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-2',
              _schema: { id: 'risk-affects', name: 'Risk Affects' },
              _in: { id: 'risk-1', name: 'Account Takeover' },
              _out: { id: 'asset-1', name: 'Customer DB', schemaId: 'data-store' }
            }
          ],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    mocks.entityGet.mockImplementation(({ params }: { params: { id: string } }) => {
      if (params.id === 'risk-1') {
        return Promise.resolve({
          _uid: 'risk-1',
          _publicId: 'RSK-001',
          _name: 'Account Takeover',
          _schema: { id: 'risk', name: 'Risk' },
          _owner: null,
          _lifecycle: null
        });
      }
      if (params.id === 'asset-1') {
        return Promise.resolve({
          _uid: 'asset-1',
          _publicId: 'AST-001',
          _name: 'Customer DB',
          _schema: { id: 'entity', name: 'Data Store' },
          _owner: null,
          _lifecycle: null
        });
      }
      return Promise.resolve({
        _uid: 'control-1',
        _publicId: 'CTL-001',
        _name: 'MFA Enforcement',
        _schema: { id: 'control', name: 'Control' },
        _owner: null,
        _lifecycle: null
      });
    });

    await renderScreen();
    expect(container.textContent).toContain('Coverage by risk');
    expect(container.textContent).toContain('Account Takeover');
    expect(container.textContent).toContain('MFA Enforcement');
    expect(container.textContent).toContain('Coverage by information asset');
    expect(container.textContent).toContain('Customer DB');
    expect(container.textContent).toContain('Data Store');
    expect(container.textContent).toContain('none');

    // Clicking a "coverage by risk" row opens the shared RiskDrawer in-situ, not a route
    // navigation — the row is a plain button (a bar-list, not a table), unlike the asset panel.
    mocks.navigate.mockClear();
    const riskRow = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Account Takeover')
    );
    await act(async () => {
      riskRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 8; i++) await flush();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('RSK-001');
    expect(container.querySelectorAll('[aria-label="Close"]').length).toBeGreaterThan(0);

    const closeButtons = [...container.querySelectorAll('button[aria-label="Close"]')];
    await act(async () => {
      closeButtons.at(-1)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 8; i++) await flush();

    // Clicking an asset row opens the local AssetDrawer in-situ, not a route navigation.
    mocks.navigate.mockClear();
    const assetRow = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer DB')
    );
    await act(async () => {
      assetRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 8; i++) await flush();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('AST-001');
    expect(container.textContent).toContain('Open record in Entities');
  });
});
