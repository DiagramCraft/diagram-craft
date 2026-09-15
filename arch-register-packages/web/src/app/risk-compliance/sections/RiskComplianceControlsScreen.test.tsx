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

  it('shows the coverage roll-up view with weakest-covered risks, and only Data Entities in the asset table', async () => {
    mocks.search = { view: 'coverage' };
    mocks.capabilityConfigurationsList.mockResolvedValue([
      {
        ...CONFIG,
        bindings: {
          ...CONFIG.bindings,
          dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } }
        }
      }
    ]);
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
          },
          { id: 'protected_entities', type: 'typedRelation', relationSchemaId: 'control-affects' }
        ]
      }
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
        // Reachable only via Risk Affects, and NOT Data Entity-schema'd — should be excluded
        // from "coverage by information asset" now that it's Data-Entity-scoped.
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-2',
              _schema: { id: 'risk-affects', name: 'Risk Affects' },
              _in: { id: 'risk-1', name: 'Account Takeover' },
              _out: { id: 'asset-1', name: 'Payments System', schemaId: 'system' }
            }
          ],
          total: 1
        });
      }
      if (query.schemaId === 'control-affects') {
        // Protected by a Control, Data Entity-schema'd — should appear.
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-3',
              _schema: { id: 'control-affects', name: 'Control Protection' },
              _in: { id: 'control-1', name: 'MFA Enforcement' },
              _out: { id: 'asset-2', name: 'Customer PII', schemaId: 'data-entity' }
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
      if (params.id === 'asset-2') {
        return Promise.resolve({
          _uid: 'asset-2',
          _publicId: 'AST-002',
          _name: 'Customer PII',
          _schema: { id: 'data-entity', name: 'Data Entity' },
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
    // Data Entity-schema'd asset (reached via control-affects) appears...
    expect(container.textContent).toContain('Customer PII');
    // ...but the System reached only via risk-affects is excluded from this panel.
    expect(container.textContent).not.toContain('Payments System');

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
      tr.textContent?.includes('Customer PII')
    );
    await act(async () => {
      assetRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 8; i++) await flush();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('AST-002');
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows the traceability matrix with control x risk membership and per-column totals', async () => {
    mocks.search = { view: 'traceability' };
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
          },
          { id: 'protected_entities', type: 'typedRelation', relationSchemaId: 'control-affects' }
        ]
      }
    ]);
    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'risk') {
        return Promise.resolve({
          items: [
            { _uid: 'risk-1', _publicId: 'RSK-001', _name: 'Account Takeover' },
            { _uid: 'risk-2', _publicId: 'RSK-002', _name: 'Data Leak' }
          ],
          total: 2
        });
      }
      return Promise.resolve({
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
              coverage: 100,
              effectiveness: 'full'
            }
          ],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    await renderScreen();

    expect(container.textContent).toContain('Account Takeover');
    expect(container.textContent).toContain('Data Leak');
    expect(container.textContent).toContain('MFA Enforcement');

    // Column headers carry the risk's reference + title (design reference's `x.ref + " " +
    // x.title`), and aren't clickable — only the Control row header is.
    const headerCells = [...container.querySelectorAll('thead th')];
    const dataLeakColumnIndex = headerCells.findIndex(th => th.textContent?.includes('Data Leak'));
    expect(dataLeakColumnIndex).toBeGreaterThan(0);

    // "Data Leak" has no covering control — the bottom totals row renders a gap mark instead of
    // a "0" for its column.
    const bottomRow = [...container.querySelectorAll('tbody tr')].at(-1);
    const dataLeakTotalCell = bottomRow?.querySelectorAll('td')[dataLeakColumnIndex - 1];
    expect(dataLeakTotalCell?.textContent).toBe('');
    expect(dataLeakTotalCell?.querySelector('span')).toBeTruthy();

    // Clicking the control's row header opens the shared ControlDrawer via navigation.
    mocks.navigate.mockClear();
    const controlHeader = [...container.querySelectorAll('tbody th')].find(th =>
      th.textContent?.includes('MFA Enforcement')
    );
    await act(async () => {
      controlHeader!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/risk-compliance/controls/$controlId',
        params: { workspaceSlug: 'ws-1', controlId: 'CTL-001' }
      })
    );

    // The dimension toggle (in the main toolbar, not the panel header) patches the `dim` search
    // param rather than navigating away.
    mocks.navigate.mockClear();
    const assetsToggle = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Controls × assets'
    );
    await act(async () => {
      assetsToggle!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/risk-compliance/controls' })
    );
  });
});
