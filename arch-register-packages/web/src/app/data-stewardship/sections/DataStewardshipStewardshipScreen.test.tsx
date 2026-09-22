// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipStewardshipScreen } from './DataStewardshipStewardshipScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
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
    changeCases: { listByEntity: mocks.changeCasesListByEntity },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

// Same rationale as `DatasetDrawer.test.tsx`: member/team resolution needs a full
// WorkspaceContext provider out of scope for this screen test, so stub it deterministically.
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
        { value: 'confidential', label: 'Confidential' },
        { value: 'internal', label: 'Internal' }
      ]
    }
  ]
};

describe('DataStewardshipStewardshipScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipStewardshipScreen />
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
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer Records',
          _owner: { id: 'team-1', name: 'Payments' },
          steward: { principal_type: 'user', principal_id: 'user-1' },
          classification: 'confidential',
          review_date: '2026-06-01',
          review_status: 'current'
        },
        {
          _uid: 'ds-2',
          _publicId: 'DS-002',
          _name: 'Support Transcripts',
          _owner: null,
          steward: null,
          classification: null,
          review_date: null,
          review_status: 'overdue'
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
      classification: 'confidential',
      steward: { principal_type: 'user', principal_id: 'user-1' },
      custodian: null,
      review_date: '2026-06-01',
      review_status: 'current'
    });
    mocks.schemasList.mockResolvedValue([DATA_ENTITY_SCHEMA]);
    mocks.changeCasesListByEntity.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists datasets with their coverage gaps and opens the drawer on row click', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Customer Records');
    expect(container.textContent).toContain('Support Transcripts');
    expect(container.textContent).toContain('Missing an owner');
    expect(container.textContent).toContain('No named owner');

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer Records')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/stewardship',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('narrows the "Gaps to close" panel to the sidebar\'s classification facet, like the table', async () => {
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer Records',
          _owner: null,
          steward: null,
          classification: 'confidential',
          review_date: null,
          review_status: 'incomplete'
        },
        {
          _uid: 'ds-2',
          _publicId: 'DS-002',
          _name: 'Support Transcripts',
          _owner: null,
          steward: null,
          classification: 'internal',
          review_date: null,
          review_status: 'incomplete'
        }
      ],
      total: 2
    });
    mocks.search = { classification: 'confidential' };
    await renderScreen();
    expect(container.textContent).toContain('Customer Records');
    expect(container.textContent).not.toContain('Support Transcripts');
  });

  it('renders the drawer when the route carries a datasetId search param', async () => {
    mocks.search = { datasetId: 'DS-001' };
    await renderScreen();
    expect(container.textContent).toContain('Open record in Entities');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Data stewardship is not enabled.');
  });
});
