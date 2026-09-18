// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiIntegrationCatalogIntegrationsScreen } from './ApiIntegrationCatalogIntegrationsScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  lifecycleStatesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  artifactsList: vi.fn(),
  apiSpecificationRevisions: vi.fn(),
  relationsList: vi.fn(),
  relationSchemasList: vi.fn(),
  relationsListForEntity: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null
}));

vi.mock('../../../auth/WorkspaceAuthorizationContext', () => ({
  useWorkspaceAuthorization: () => ({ canViewArtifactContent: true, canManageArtifacts: true })
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    relations: { list: mocks.relationsList, listForEntity: mocks.relationsListForEntity },
    relationSchemas: { list: mocks.relationSchemasList },
    artifacts: {
      list: mocks.artifactsList,
      listApiSpecificationRevisions: mocks.apiSpecificationRevisions
    },
    config: {
      lifecycleStates: { list: mocks.lifecycleStatesList },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
  }
}));

const CONFIG = {
  type: 'api-specification',
  valid: true,
  bindings: {
    api: { target: { kind: 'entity_schema', id: 'api' } }
  }
};

const API_SCHEMA = {
  id: 'api',
  name: 'API',
  fields: [
    {
      id: 'providers',
      name: 'Provided by',
      type: 'typedRelation',
      relationSchemaId: 'provides-api'
    },
    {
      id: 'consumers',
      name: 'Consumed by',
      type: 'typedRelation',
      relationSchemaId: 'consumes-api'
    }
  ]
};

const FLOW_RELATION_SCHEMA = {
  id: 'rs-data-flow',
  name: 'Data Flow',
  fields: [
    {
      id: 'protocol',
      name: 'Protocol',
      type: 'select',
      options: [{ value: 'https', label: 'HTTPS' }]
    },
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      options: [{ value: 'sensitive', label: 'Sensitive' }]
    }
  ]
};

const FLOW_RELATION = {
  _uid: 'flow-1',
  _schema: { id: 'rs-data-flow', name: 'Data Flow' },
  _in: { id: 'sys-a', name: 'System A' },
  _out: { id: 'sys-b', name: 'System B' },
  protocol: 'https',
  data_classification: 'sensitive',
  cross_boundary: 'cross-boundary',
  data_entities: ['de-1']
};

const PROVIDES_RELATION = {
  _uid: 'rel-provides-1',
  _schema: { id: 'provides-api', name: 'Provides API' },
  _in: { id: 'sys-a', name: 'System A' },
  _out: { id: 'api-1', name: 'Orders API' }
};

describe('ApiIntegrationCatalogIntegrationsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ApiIntegrationCatalogIntegrationsScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 10; i++) await flush();
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
    mocks.schemasList.mockResolvedValue([API_SCHEMA]);
    mocks.lifecycleStatesList.mockResolvedValue([]);
    mocks.relationSchemasList.mockResolvedValue([FLOW_RELATION_SCHEMA]);
    mocks.relationsList.mockImplementation(async ({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'rs-data-flow') return { items: [FLOW_RELATION], total: 1 };
      if (query.schemaId === 'provides-api') return { items: [PROVIDES_RELATION], total: 1 };
      return { items: [], total: 0 };
    });
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
    mocks.entityGet.mockImplementation(async ({ params }: { params: { id: string } }) => {
      const byId: Record<string, { _uid: string; _publicId: string; _name: string }> = {
        'sys-a': { _uid: 'sys-a', _publicId: 'SYS-A', _name: 'System A' },
        'sys-b': { _uid: 'sys-b', _publicId: 'SYS-B', _name: 'System B' },
        'de-1': { _uid: 'de-1', _publicId: 'DE-1', _name: 'Customer PII' },
        'api-1': {
          _uid: 'api-1',
          _publicId: 'API-001',
          _name: 'Orders API'
        }
      };
      return (
        byId[params.id] ?? {
          _uid: params.id,
          _publicId: params.id,
          _name: params.id,
          _schema: { id: 'api', name: 'API' },
          _owner: null,
          _lifecycle: null
        }
      );
    });
    mocks.artifactsList.mockResolvedValue({ artifacts: [], status: 'not_configured' });
    mocks.apiSpecificationRevisions.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists Data Flow relations with protocol, classification, and boundary', async () => {
    await renderScreen();
    expect(container.textContent).toContain('System A → System B');
    expect(container.textContent).toContain('HTTPS');
    expect(container.textContent).toContain('Sensitive');
    expect(container.textContent).toContain('crosses');
    expect(container.textContent).toContain('Orders API');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('API & Integration Catalog is not enabled.');
  });

  it('shows a not-configured empty state when no Data Flow relation schema exists', async () => {
    mocks.relationSchemasList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('No Data Flow relation is configured');
  });

  it('opens the integration drawer on row click, with a link to the registered API', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('System A')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 10; i++) await flush();

    expect(container.textContent).toContain('Open specification — Orders API');

    const button = [...container.querySelectorAll('button')].find(el =>
      el.textContent?.includes('Open specification')
    );
    expect(button).toBeDefined();
    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 10; i++) await flush();

    expect(container.textContent).toContain('Open record in Entities');
  });
});
