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
  relationsList: vi.fn(),
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
    relations: { listForEntity: mocks.relationsListForEntity, list: mocks.relationsList },
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
    mocks.apiSpecification.mockResolvedValue({
      revision: { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 0 },
      items: [],
      total: 0,
      limit: 200,
      offset: 0
    });
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
    mocks.relationsList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'provides-api') {
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-provides-1',
              _schema: { id: 'provides-api', name: 'Provides API' },
              _in: { id: 'system-1', name: 'Orders System' },
              _out: { id: 'api-1', name: 'Orders API' }
            }
          ],
          total: 1
        });
      }
      if (query.schemaId === 'consumes-api') {
        return Promise.resolve({
          items: [
            {
              _uid: 'rel-consumes-1',
              _schema: { id: 'consumes-api', name: 'Consumes API' },
              _in: { id: 'system-2', name: 'Checkout System' },
              _out: { id: 'api-1', name: 'Orders API' }
            },
            {
              _uid: 'rel-consumes-2',
              _schema: { id: 'consumes-api', name: 'Consumes API' },
              _in: { id: 'system-3', name: 'Fulfillment System' },
              _out: { id: 'api-1', name: 'Orders API' }
            }
          ],
          total: 2
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
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

  it('lists APIs and opens the shared entity drawer via the drawer search param on row click', async () => {
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

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const [{ search }] = mocks.navigate.mock.calls[0]!;
    expect(search({})).toEqual({ drawer: 'API-001' });
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

  it('shows Providers/Consumers columns and sorts by consumers', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Orders System');
    expect(container.textContent).toContain('Checkout System');
    expect(container.textContent).toContain('Fulfillment System');

    const sortButton = [...container.querySelectorAll('th')].find(th =>
      th.textContent?.includes('Consumers')
    );
    expect(sortButton).toBeDefined();
    await act(async () => {
      sortButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const rowsAfterSort = [...container.querySelectorAll('tbody tr')].map(tr => tr.textContent);
    // api-1 (2 consumers) should sort ahead of api-2 (0 consumers) in descending order.
    expect(rowsAfterSort[0]).toContain('Orders API');
  });

  it('narrows the catalog by protocol/lifecycle/owner facet params', async () => {
    mocks.search = { protocol: 'asyncapi' };
    await renderScreen();
    expect(container.textContent).toContain('Payments API');
    expect(container.textContent).not.toContain('Orders API');
  });

  it('shows a flat cross-API Operations table and navigates to the right API on row click', async () => {
    mocks.search = { view: 'operations' };
    mocks.apiSpecificationRevisions.mockResolvedValue([
      {
        revision: { id: 'rev-1' },
        isCurrent: true,
        itemCount: 1,
        protocol: 'openapi',
        status: 'current'
      }
    ]);
    mocks.artifactsList.mockResolvedValue({
      artifacts: [
        {
          id: 'artifact-1',
          artifactType: 'api-specification',
          status: 'current',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ],
      status: 'current'
    });
    mocks.apiSpecification.mockResolvedValue({
      revision: { revision: { id: 'rev-1' }, isCurrent: true, itemCount: 1 },
      items: [
        {
          id: 'op-1',
          itemKey: 'op-1',
          revisionId: 'rev-1',
          protocol: 'openapi',
          itemKind: 'operation',
          path: '/orders',
          channel: null,
          action: 'get',
          identifier: 'getOrders',
          declaredIdentifier: null,
          summary: null,
          description: null,
          tags: [],
          deprecated: false,
          parameters: []
        }
      ],
      total: 1,
      limit: 200,
      offset: 0
    });

    await renderScreen();
    expect(container.textContent).toContain('GET');
    expect(container.textContent).toContain('/orders');

    const row = [...container.querySelectorAll('tbody tr')].find(tr =>
      tr.textContent?.includes('/orders')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const [{ search }] = mocks.navigate.mock.calls[0]!;
    expect(search({})).toEqual({ drawer: 'API-001' });
  });
});
