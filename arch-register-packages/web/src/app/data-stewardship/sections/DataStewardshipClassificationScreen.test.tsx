// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipClassificationScreen } from './DataStewardshipClassificationScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationSchemasList: vi.fn(),
  relationsList: vi.fn(),
  changeCasesListByEntity: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string },
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
    relationSchemas: { list: mocks.relationSchemasList },
    relations: { list: mocks.relationsList },
    changeCases: { listByEntity: mocks.changeCasesListByEntity },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => (principal: { principal_id?: string } | null | undefined) =>
    principal?.principal_id ? `Principal ${principal.principal_id}` : undefined
}));

vi.mock('./DatasetDrawer', () => ({
  DatasetDrawer: () => <div>Open record in Entities</div>
}));

const CONFIG = {
  type: 'data-stewardship',
  valid: true,
  bindings: { dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } } }
};

const DATA_ENTITY_SCHEMA = {
  id: 'data-entity',
  name: 'Data Entity',
  fields: [
    {
      id: 'classification',
      name: 'Classification',
      type: 'select',
      options: [
        { value: 'sensitive', label: 'Sensitive' },
        { value: 'public', label: 'Public' }
      ]
    }
  ]
};

const DATA_FLOW_RELATION_SCHEMA = {
  id: 'rs-data-flow',
  name: 'Data Flow',
  fields: [
    {
      id: 'data_classification',
      name: 'Classification',
      type: 'select',
      options: [
        { value: 'sensitive', label: 'Sensitive' },
        { value: 'highly-sensitive', label: 'Highly Sensitive' },
        { value: 'public', label: 'Public' }
      ]
    },
    { id: 'protocol', name: 'Protocol', type: 'select', options: [] },
    { id: 'source_residency_region', name: 'Source Region', type: 'select', options: [] },
    {
      id: 'destination_residency_region',
      name: 'Destination Region',
      type: 'select',
      options: []
    }
  ]
};

describe('DataStewardshipClassificationScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipClassificationScreen />
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
    mocks.schemasList.mockResolvedValue([DATA_ENTITY_SCHEMA]);
    mocks.relationSchemasList.mockResolvedValue([]);
    mocks.relationsList.mockResolvedValue({ items: [], total: 0 });
    mocks.changeCasesListByEntity.mockResolvedValue([]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer Records',
          _owner: { id: 'team-1', name: 'Payments' },
          steward: { principal_type: 'user', principal_id: 'user-1' },
          classification: 'sensitive',
          regulatory_tags: null,
          processing_purposes: null
        },
        {
          _uid: 'ds-2',
          _publicId: 'DS-002',
          _name: 'Public Catalog',
          _owner: null,
          steward: null,
          classification: 'public',
          regulatory_tags: 'gdpr',
          processing_purposes: 'marketing'
        }
      ],
      total: 2
    });
    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-1',
      _publicId: 'DS-001',
      _name: 'Customer Records',
      _schema: { id: 'data-entity', name: 'Data Entity' },
      _owner: { id: 'team-1', name: 'Payments' },
      _lifecycle: null,
      classification: 'sensitive',
      steward: { principal_type: 'user', principal_id: 'user-1' },
      custodian: null
    });
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
    expect(container.textContent).toContain('Data stewardship is not enabled.');
  });

  it('lists datasets with classification and personal-data columns, and opens the drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Customer Records');
    expect(container.textContent).toContain('Public Catalog');
    expect(container.textContent).toContain('Restricted datasets');

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer Records')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders the drawer when the route carries a datasetId search param', async () => {
    mocks.search = { datasetId: 'DS-001' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a "Datasets by classification" breakdown, clicking a row narrows the classification facet', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Datasets by classification');
    expect(container.textContent).toContain('Sensitive');

    const row = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Sensitive')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders the view switcher below the stat tiles, matching the design reference layout', async () => {
    await renderScreen();
    const html = container.innerHTML;
    const statsIndex = html.indexOf('Restricted datasets');
    const switcherIndex = html.indexOf('Restricted flows');
    expect(statsIndex).toBeGreaterThan(-1);
    expect(switcherIndex).toBeGreaterThan(statsIndex);
  });

  it('switches views via the in-screen toggle group', async () => {
    await renderScreen();
    const restrictedFlowsToggle = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Restricted flows'
    );
    expect(restrictedFlowsToggle).toBeDefined();
    await act(async () => {
      restrictedFlowsToggle!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('shows a not-configured notice for restricted flows when no Data Flow schema exists', async () => {
    mocks.search = { view: 'restricted-flows' };
    await renderScreen();
    expect(container.textContent).toContain('Restricted flows');
    expect(container.textContent).toContain('API & Integration Catalog');
  });

  it('shows a not-configured notice for cross-boundary transfers when no Data Flow schema exists', async () => {
    mocks.search = { view: 'cross-boundary' };
    await renderScreen();
    expect(container.textContent).toContain('Cross-boundary transfers');
    expect(container.textContent).toContain('API & Integration Catalog');
  });

  it('lists restricted flows filtered to sensitive/highly-sensitive when Data Flow is configured', async () => {
    mocks.relationSchemasList.mockResolvedValue([DATA_FLOW_RELATION_SCHEMA]);
    mocks.relationsList.mockResolvedValue({
      items: [
        {
          _uid: 'flow-1',
          _in: { id: 'sys-1', name: 'CRM' },
          _out: { id: 'sys-2', name: 'Warehouse' },
          data_classification: 'sensitive',
          protocol: null,
          data_entities: []
        },
        {
          _uid: 'flow-2',
          _in: { id: 'sys-1', name: 'CRM' },
          _out: { id: 'sys-3', name: 'Marketing' },
          data_classification: 'public',
          protocol: null,
          data_entities: []
        }
      ],
      total: 2
    });
    mocks.search = { view: 'restricted-flows' };
    await renderScreen();
    expect(container.textContent).toContain('Warehouse');
    expect(container.textContent).not.toContain('Marketing');
  });

  it('flags an unsafeguarded personal-data cross-boundary transfer', async () => {
    mocks.relationSchemasList.mockResolvedValue([DATA_FLOW_RELATION_SCHEMA]);
    mocks.relationsList.mockResolvedValue({
      items: [
        {
          _uid: 'flow-1',
          _in: { id: 'sys-1', name: 'CRM' },
          _out: { id: 'sys-2', name: 'Warehouse' },
          data_classification: 'sensitive',
          cross_boundary: 'cross-boundary',
          source_residency_region: 'eu',
          destination_residency_region: 'us'
        },
        {
          _uid: 'flow-2',
          _in: { id: 'sys-1', name: 'CRM' },
          _out: { id: 'sys-3', name: 'Analytics' },
          data_classification: 'public',
          cross_boundary: 'cross-boundary',
          source_residency_region: 'eu',
          destination_residency_region: 'us'
        }
      ],
      total: 2
    });
    mocks.search = { view: 'cross-boundary' };
    await renderScreen();
    expect(container.textContent).toContain('no transfer safeguard recorded');
    expect(container.textContent).toContain('Unsafeguarded personal-data transfers');
  });
});
