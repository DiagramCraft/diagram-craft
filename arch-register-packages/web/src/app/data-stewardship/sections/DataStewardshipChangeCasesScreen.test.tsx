// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { DataStewardshipChangeCasesScreen } from './DataStewardshipChangeCasesScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  membersList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  casesList: vi.fn(),
  caseGet: vi.fn(),
  caseEvents: vi.fn(),
  governanceTasksMine: vi.fn(),
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
    config: {
      members: { list: mocks.membersList },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    },
    governance: {
      cases: { list: mocks.casesList, get: mocks.caseGet, events: mocks.caseEvents },
      assignments: { mine: mocks.governanceTasksMine }
    }
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

const changeCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'case-1',
  workspace: 'ws-1',
  caseKind: 'entity.change-case',
  subjectType: 'entity',
  subjectId: 'ds-1',
  subjectVersion: null,
  status: 'open',
  outcome: null,
  policyVersion: null,
  initiatorUserId: 'user-1',
  parentCaseId: null,
  selfApprovalAllowed: false,
  payload: { entityId: 'ds-1' },
  initiationFields: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  completedAt: null,
  cancelledAt: null,
  escalatedAt: null,
  ...overrides
});

const datasetEntity = (overrides: Record<string, unknown> = {}) => ({
  _uid: 'ds-1',
  _publicId: 'DS-001',
  _name: 'Customer Records',
  _schema: { id: 'data-entity', name: 'Data Entity' },
  steward: { principal_type: 'user', principal_id: 'user-2' },
  ...overrides
});

describe('DataStewardshipChangeCasesScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
            <DataStewardshipChangeCasesScreen />
          </DialogContextProvider>
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
    mocks.membersList.mockResolvedValue([{ user_id: 'user-1', display_name: 'Alex Requester' }]);
    mocks.casesList.mockResolvedValue([changeCase()]);
    mocks.entityGet.mockResolvedValue(datasetEntity());
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.governanceTasksMine.mockResolvedValue([]);
    mocks.caseGet.mockResolvedValue(changeCase());
    mocks.caseEvents.mockResolvedValue([]);
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

  it('lists change cases with the joined dataset, requester and steward', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Customer Records');
    expect(container.textContent).toContain('Alex Requester');
    expect(container.textContent).toContain('Principal user-2');
  });

  it('opens the shared case drawer on row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer Records')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/change-cases',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders the case drawer when the route carries a caseId search param', async () => {
    mocks.search = { caseId: 'case-1' };
    await renderScreen();
    expect(container.textContent).toContain('Entity Change Case');
  });
});
