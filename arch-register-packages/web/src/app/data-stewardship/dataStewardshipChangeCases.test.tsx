// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import {
  useDataStewardshipChangeCases,
  type DataStewardshipChangeCaseRow
} from './dataStewardshipChangeCases';

const mocks = vi.hoisted(() => ({
  casesList: vi.fn(),
  entityGet: vi.fn(),
  membersList: vi.fn()
}));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    governance: { cases: { list: mocks.casesList } },
    entities: { get: mocks.entityGet },
    config: { members: { list: mocks.membersList } }
  }
}));

const governanceCase = (overrides: Partial<GovernanceCase> = {}): GovernanceCase => ({
  id: 'case-1',
  workspace: 'ws-1',
  caseKind: 'entity.change-case',
  subjectType: 'entity',
  subjectId: 'entity-1',
  subjectVersion: null,
  status: 'open',
  outcome: null,
  policyVersion: null,
  initiatorUserId: 'user-1',
  parentCaseId: null,
  selfApprovalAllowed: false,
  payload: { entityId: 'entity-1' },
  initiationFields: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  completedAt: null,
  cancelledAt: null,
  escalatedAt: null,
  ...overrides
});

const entity = (overrides: Record<string, unknown> = {}) => ({
  _uid: 'entity-1',
  _publicId: 'DS-001',
  _name: 'Customer Records',
  _schema: { id: 'data-entity', name: 'Data Entity' },
  ...overrides
});

let latest: { rows: DataStewardshipChangeCaseRow[]; isLoading: boolean } | undefined;

const Harness = ({ dataEntitySchemaId }: { dataEntitySchemaId: string | null }) => {
  latest = useDataStewardshipChangeCases('ws-1', dataEntitySchemaId);
  return null;
};

describe('useDataStewardshipChangeCases', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.casesList.mockReset();
    mocks.entityGet.mockReset();
    mocks.membersList.mockReset();
    mocks.membersList.mockResolvedValue([
      { user_id: 'user-1', display_name: 'Alex Requester' }
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (dataEntitySchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness dataEntitySchemaId={dataEntitySchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('joins entity.change-case cases to their dataset and resolves the requester name', async () => {
    mocks.casesList.mockResolvedValue([governanceCase()]);
    mocks.entityGet.mockResolvedValue(entity());

    render('data-entity');
    await flush();

    expect(latest?.rows).toHaveLength(1);
    expect(latest?.rows[0]?.dataset._name).toBe('Customer Records');
    expect(latest?.rows[0]?.requesterName).toBe('Alex Requester');
  });

  it('drops cases whose subject is not a Data Entity of the configured schema', async () => {
    mocks.casesList.mockResolvedValue([governanceCase()]);
    mocks.entityGet.mockResolvedValue(entity({ _schema: { id: 'other-schema', name: 'Other' } }));

    render('data-entity');
    await flush();

    expect(latest?.rows).toHaveLength(0);
  });

  it('drops case kinds other than entity.change-case', async () => {
    mocks.casesList.mockResolvedValue([governanceCase({ caseKind: 'field-date-reminder' })]);

    render('data-entity');
    await flush();

    expect(latest?.rows).toHaveLength(0);
    expect(mocks.entityGet).not.toHaveBeenCalled();
  });

  it('falls back to the raw user id when the requester is not a known member', async () => {
    mocks.casesList.mockResolvedValue([governanceCase({ initiatorUserId: 'user-unknown' })]);
    mocks.entityGet.mockResolvedValue(entity());

    render('data-entity');
    await flush();

    expect(latest?.rows[0]?.requesterName).toBe('user-unknown');
  });
});
