// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiIntegrationCatalogSidebar } from './ApiIntegrationCatalogSidebar';
import {
  IC_APIS_ID,
  IC_IMPACT_ID,
  IC_INTEGRATIONS_ID,
  type ApiIntegrationCatalogRailItemId
} from '../apiIntegrationCatalogSections';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  relationSchemasList: vi.fn(),
  relationsList: vi.fn(),
  entityList: vi.fn(),
  schemasList: vi.fn(),
  lifecycleStatesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    relationSchemas: { list: mocks.relationSchemasList },
    relations: { list: mocks.relationsList },
    entities: { list: mocks.entityList },
    schemas: { list: mocks.schemasList },
    config: {
      lifecycleStates: { list: mocks.lifecycleStatesList },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
  }
}));

const CONFIG = {
  type: 'api-specification',
  valid: true,
  bindings: { api: { target: { kind: 'entity_schema', id: 'api' } } }
};

const FLOW_RELATION_SCHEMA = {
  id: 'rs-data-flow',
  name: 'Data Flow',
  fields: [
    {
      id: 'protocol',
      name: 'Protocol',
      type: 'select',
      options: [
        { value: 'https', label: 'HTTPS' },
        { value: 'kafka', label: 'Kafka' }
      ]
    },
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      options: [{ value: 'sensitive', label: 'Sensitive' }]
    }
  ]
};

const API_SCHEMA = {
  id: 'api',
  name: 'API',
  fields: [
    {
      id: 'protocols',
      name: 'Protocols',
      type: 'select',
      options: [
        { value: 'openapi', label: 'OpenAPI' },
        { value: 'asyncapi', label: 'AsyncAPI' }
      ]
    },
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

const LIFECYCLE_STATES = [
  { id: 'active', label: 'Active' },
  { id: 'retired', label: 'Retired' }
];

const API_ENTITIES = [
  {
    _uid: 'api-1',
    _publicId: 'API-1',
    _name: 'Catalog API',
    protocols: ['openapi', 'asyncapi'],
    _lifecycle: { id: 'active' },
    _owner: { id: 'team-a', name: 'Team A' }
  },
  {
    _uid: 'api-2',
    _publicId: 'API-2',
    _name: 'Pricing API',
    protocols: ['openapi'],
    _lifecycle: { id: 'retired' },
    _owner: { id: 'team-b', name: 'Team B' }
  }
];

describe('ApiIntegrationCatalogSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderSidebar = async (
    activeSection: ApiIntegrationCatalogRailItemId = IC_INTEGRATIONS_ID
  ) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ApiIntegrationCatalogSidebar workspaceSlug="ws-1" activeSection={activeSection} />
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
    mocks.search = {};
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.relationSchemasList.mockResolvedValue([FLOW_RELATION_SCHEMA]);
    mocks.schemasList.mockResolvedValue([API_SCHEMA]);
    mocks.lifecycleStatesList.mockResolvedValue(LIFECYCLE_STATES);
    mocks.entityList.mockResolvedValue({ items: API_ENTITIES, total: API_ENTITIES.length });
    mocks.relationsList.mockResolvedValue({
      items: [
        {
          _uid: 'flow-1',
          _schema: { id: 'rs-data-flow', name: 'Data Flow' },
          _in: { id: 'sys-a', name: 'System A' },
          _out: { id: 'sys-b', name: 'System B' },
          protocol: 'https',
          data_classification: 'sensitive',
          cross_boundary: 'cross-boundary'
        },
        {
          _uid: 'flow-2',
          _schema: { id: 'rs-data-flow', name: 'Data Flow' },
          _in: { id: 'sys-c', name: 'System C' },
          _out: { id: 'sys-d', name: 'System D' },
          protocol: 'kafka',
          data_classification: 'sensitive',
          cross_boundary: 'same-region'
        }
      ],
      total: 2
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('renders Integrations facets — all/boundary toggle, protocol and classification counts', async () => {
    await renderSidebar(IC_INTEGRATIONS_ID);
    expect(container.textContent).toContain('All integrations');
    expect(container.textContent).toContain('Crosses a boundary');
    expect(container.textContent).toContain('HTTPS');
    expect(container.textContent).toContain('Kafka');
    expect(container.textContent).toContain('Sensitive');
  });

  it('narrows to a protocol when its facet is clicked', async () => {
    await renderSidebar(IC_INTEGRATIONS_ID);
    const entry = container.querySelector('[data-testid="integration-facet-protocol-https"]');
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/api-integration-catalog/integrations',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('toggles the boundary facet', async () => {
    await renderSidebar(IC_INTEGRATIONS_ID);
    const entry = container.querySelector('[data-testid="integration-facet-boundary"]');
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/api-integration-catalog/integrations',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('falls back to the plain section nav for other sections', async () => {
    await renderSidebar(IC_IMPACT_ID);
    expect(container.textContent).toContain('Sections');
    expect(container.textContent).toContain('APIs');
    expect(container.textContent).not.toContain('All integrations');
  });

  it('renders APIs facets — all/protocol/lifecycle/owner counts', async () => {
    await renderSidebar(IC_APIS_ID);
    expect(container.textContent).toContain('All APIs');
    expect(container.textContent).toContain('OpenAPI');
    expect(container.textContent).toContain('AsyncAPI');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('Retired');
    expect(container.textContent).toContain('Team A');
    expect(container.textContent).toContain('Team B');
    // Multi-value protocols field: both APIs carry 'openapi', only one carries 'asyncapi'.
    const openapiRow = container.querySelector('[data-testid="api-facet-protocol-openapi"]');
    expect(openapiRow?.textContent).toContain('2');
    const asyncapiRow = container.querySelector('[data-testid="api-facet-protocol-asyncapi"]');
    expect(asyncapiRow?.textContent).toContain('1');
  });

  it('narrows to a protocol when its facet is clicked, and toggles off on second click', async () => {
    await renderSidebar(IC_APIS_ID);
    const entry = container.querySelector('[data-testid="api-facet-protocol-asyncapi"]');
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/api-integration-catalog/apis',
        params: { workspaceSlug: 'ws-1' }
      })
    );
    const patch = mocks.navigate.mock.calls.at(-1)?.[0].search({});
    expect(patch).toEqual({ protocol: 'asyncapi' });
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderSidebar(IC_INTEGRATIONS_ID);
    expect(container.textContent).toContain('API & Integration Catalog is not enabled.');
  });
});
