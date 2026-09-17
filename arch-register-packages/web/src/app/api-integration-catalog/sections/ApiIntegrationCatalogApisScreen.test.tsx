// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiIntegrationCatalogApisScreen } from './ApiIntegrationCatalogApisScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  lifecycleStatesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  artifactsList: vi.fn(),
  apiSpecificationRevisions: vi.fn(),
  apiSpecification: vi.fn(),
  relationsListForEntity: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string; apiId?: string },
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
    relations: { listForEntity: mocks.relationsListForEntity },
    artifacts: {
      list: mocks.artifactsList,
      listApiSpecificationRevisions: mocks.apiSpecificationRevisions,
      listApiSpecification: mocks.apiSpecification
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
    { id: 'protocols', name: 'Protocols', type: 'select', options: [] },
    { id: 'api_version', name: 'API Version', type: 'text' },
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

describe('ApiIntegrationCatalogApisScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ApiIntegrationCatalogApisScreen />
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
    mocks.schemasList.mockResolvedValue([API_SCHEMA]);
    mocks.lifecycleStatesList.mockResolvedValue([]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'api-1',
          _publicId: 'API-001',
          _name: 'Orders API',
          _owner: { id: 'user-1', name: 'Jane Doe' },
          _lifecycle: null,
          protocols: ['openapi'],
          api_version: 'v1'
        },
        {
          _uid: 'api-2',
          _publicId: 'API-002',
          _name: 'Payments API',
          _owner: null,
          _lifecycle: null,
          protocols: ['asyncapi'],
          api_version: 'v2'
        }
      ],
      total: 2
    });
    mocks.artifactsList.mockResolvedValue({ artifacts: [], status: 'not_configured' });
    mocks.apiSpecificationRevisions.mockResolvedValue([]);
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
    mocks.entityGet.mockResolvedValue({
      _uid: 'api-1',
      _publicId: 'API-001',
      _name: 'Orders API',
      _schema: { id: 'api', name: 'API' },
      _owner: { id: 'user-1', name: 'Jane Doe' },
      _lifecycle: null,
      protocols: ['openapi'],
      api_version: 'v1'
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists APIs and opens the spec drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Orders API');
    expect(container.textContent).toContain('API-001');

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Orders API')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/api-integration-catalog/apis/$apiId',
        params: { workspaceSlug: 'ws-1', apiId: 'API-001' }
      })
    );
  });

  it('renders the drawer when the route carries an apiId param', async () => {
    mocks.params = { workspaceSlug: 'ws-1', apiId: 'api-1' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('API & Integration Catalog is not enabled.');
  });

  it('filters rows by the q search param', async () => {
    mocks.search = { q: 'Payments' };
    await renderScreen();
    expect(container.textContent).toContain('Payments API');
    expect(container.textContent).not.toContain('Orders API');
  });
});
