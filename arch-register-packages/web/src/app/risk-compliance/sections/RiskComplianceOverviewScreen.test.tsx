// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskComplianceOverviewScreen } from './RiskComplianceOverviewScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationsList: vi.fn(),
  relationsListForEntity: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  assessmentsList: vi.fn(),
  projectsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string }
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => ({})
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    relations: { list: mocks.relationsList, listForEntity: mocks.relationsListForEntity },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } },
    assessments: { list: mocks.assessmentsList },
    projects: { list: mocks.projectsList }
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

describe('RiskComplianceOverviewScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskComplianceOverviewScreen />
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
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.entityList.mockImplementation(({ params }: { params: { schemaId?: string } }) => {
      if (params.schemaId === 'control') {
        return Promise.resolve({
          items: [
            {
              _uid: 'ctrl-1',
              _publicId: 'CTL-001',
              _name: 'MFA',
              control_type: 'preventive',
              operating_effectiveness: 'effective'
            }
          ],
          total: 1
        });
      }
      return Promise.resolve({
        items: [
          {
            _uid: 'risk-1',
            _publicId: 'RSK-001',
            _name: 'Customer Account Takeover',
            category: 'security',
            status: 'open',
            likelihood: 5,
            impact: 5,
            inherent_risk_score: 25,
            residual_risk_score: 25
          }
        ],
        total: 1
      });
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
          { id: 'mitigating_controls', type: 'typedRelation', relationSchemaId: 'risk-control' }
        ]
      },
      { id: 'control', name: 'Control', fields: [] }
    ]);
    mocks.relationsList.mockResolvedValue({ items: [], total: 0 });
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
    mocks.assessmentsList.mockResolvedValue([]);
    mocks.projectsList.mockResolvedValue([]);
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
    expect(container.textContent).toContain('Risk & Compliance is not enabled.');
  });

  it('renders the stat strip and highest-residual-risks panel, opening the drawer on click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Outside appetite');
    expect(container.textContent).toContain('Control coverage');
    expect(container.textContent).toContain('Highest residual risks');
    expect(container.textContent).toContain('Customer Account Takeover');

    const row = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Customer Account Takeover')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 4; i++) await flush();

    // The screen opens the shared entity drawer through `useEntityDrawer()` rather than rendering
    // its own `<EntityDrawer>` — the actual drawer is mounted centrally by `WorkspaceLayout`.
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.any(Function) })
    );
  });
});
