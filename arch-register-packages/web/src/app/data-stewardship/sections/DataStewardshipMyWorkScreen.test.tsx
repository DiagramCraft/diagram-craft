// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipMyWorkScreen } from './DataStewardshipMyWorkScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  changeCasesListByEntity: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  assignmentsMine: vi.fn(),
  casesList: vi.fn(),
  governanceCaseGet: vi.fn(),
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
    governance: {
      assignments: { mine: mocks.assignmentsMine },
      cases: { list: mocks.casesList, get: mocks.governanceCaseGet }
    },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => (principal: { principal_id?: string } | null | undefined) =>
    principal?.principal_id ? `Principal ${principal.principal_id}` : undefined
}));

const CONFIG = {
  type: 'data-stewardship',
  valid: true,
  bindings: { dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } } }
};

const governanceCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'case-1',
  workspace: 'ws-1',
  caseKind: 'field-date-reminder',
  subjectType: 'entity',
  subjectId: 'ds-1',
  subjectVersion: null,
  status: 'open',
  outcome: null,
  policyVersion: null,
  initiatorUserId: null,
  parentCaseId: null,
  selfApprovalAllowed: false,
  payload: { fieldName: 'review_date' },
  initiationFields: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  completedAt: null,
  cancelledAt: null,
  escalatedAt: null,
  ...overrides
});

describe('DataStewardshipMyWorkScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipMyWorkScreen />
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
    mocks.schemasList.mockResolvedValue([{ id: 'data-entity', name: 'Data Entity', fields: [] }]);
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-1',
      _publicId: 'DS-001',
      _name: 'Customer Records',
      _schema: { id: 'data-entity', name: 'Data Entity' },
      review_status: 'current'
    });
    mocks.assignmentsMine.mockResolvedValue([]);
    mocks.casesList.mockResolvedValue([]);
    mocks.changeCasesListByEntity.mockResolvedValue([]);
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

  it('defaults to the "Assigned to me" scope and renders the queue from assignments.mine', async () => {
    mocks.assignmentsMine.mockResolvedValue([
      {
        assignment: {
          id: 'a-1',
          caseId: 'case-1',
          action: 'acknowledge',
          targetType: 'user',
          targetUserId: 'user-1',
          targetTeamId: null,
          targetTeamRole: null,
          targetCapability: null,
          status: 'open',
          createdAt: '2026-01-01T00:00:00.000Z',
          resolvedAt: null
        },
        case: governanceCase(),
        requiresAction: true
      }
    ]);
    await renderScreen();

    expect(container.textContent).toContain('My work');
    expect(container.textContent).toContain('Assigned to me — reviews');
    expect(container.textContent).toContain('Date reminder · review_date');
    expect(container.textContent).toContain('Customer Records');
  });

  it('reads the scope from the search param rather than an in-screen tab', async () => {
    mocks.search = { scope: 'all' };
    mocks.casesList.mockResolvedValue([governanceCase({ id: 'case-2' })]);
    await renderScreen();

    // The queue list itself comes from governance.cases.list (workspace-wide), not the "mine"
    // assignments — even though "mine" is still fetched separately to back the "Assigned to me"
    // stat tile.
    expect(container.textContent).toContain('All open items — reviews');
    expect(container.textContent).not.toContain('No queue items match'); // sanity: real content rendered
  });

  it('opens the dataset drawer for a field-date-reminder row', async () => {
    mocks.assignmentsMine.mockResolvedValue([
      { assignment: null, case: governanceCase(), requiresAction: false }
    ]);
    await renderScreen();

    const row = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Customer Records')
    );
    expect(row).toBeDefined();
    await act(async () => row!.click());

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship',
        params: { workspaceSlug: 'ws-1' }
      })
    );
    const call = mocks.navigate.mock.calls.at(-1)?.[0];
    expect(call.search({})).toEqual({ datasetId: 'DS-001' });
  });

  it('opens the case drawer for a change-case row', async () => {
    mocks.assignmentsMine.mockResolvedValue([
      {
        assignment: null,
        case: governanceCase({ id: 'case-3', caseKind: 'entity.change-case', payload: {} }),
        requiresAction: false
      }
    ]);
    await renderScreen();

    const row = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Customer Records')
    );
    expect(row).toBeDefined();
    await act(async () => row!.click());

    const call = mocks.navigate.mock.calls.at(-1)?.[0];
    expect(call.search({})).toEqual({ caseId: 'case-3' });
  });
});
