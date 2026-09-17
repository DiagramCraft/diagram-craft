// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import {
  queueItemPriority,
  useDataStewardshipQueue,
  type DataStewardshipQueueItem
} from './dataStewardshipQueue';

const mocks = vi.hoisted(() => ({
  assignmentsMine: vi.fn(),
  casesList: vi.fn(),
  entityGet: vi.fn()
}));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    governance: {
      assignments: { mine: mocks.assignmentsMine },
      cases: { list: mocks.casesList }
    },
    entities: { get: mocks.entityGet }
  }
}));

const governanceCase = (overrides: Partial<GovernanceCase> = {}): GovernanceCase => ({
  id: 'case-1',
  workspace: 'ws-1',
  caseKind: 'field-date-reminder',
  subjectType: 'entity',
  subjectId: 'entity-1',
  subjectVersion: null,
  status: 'open',
  outcome: null,
  policyVersion: null,
  initiatorUserId: null,
  parentCaseId: null,
  selfApprovalAllowed: false,
  payload: {},
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

describe('queueItemPriority', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');

  it('is high once escalated, regardless of due date', () => {
    expect(
      queueItemPriority(governanceCase({ escalatedAt: '2026-09-01T00:00:00.000Z' }), now)
    ).toBe('high');
  });

  it('is high once overdue', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(
      'high'
    );
  });

  it('is medium when due within 7 days', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-09-20T00:00:00.000Z' }), now)).toBe(
      'medium'
    );
  });

  it('is low when due further out, or with no due date at all', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-10-20T00:00:00.000Z' }), now)).toBe(
      'low'
    );
    expect(queueItemPriority(governanceCase({ dueAt: null }), now)).toBe('low');
  });
});

let latest: { items: DataStewardshipQueueItem[]; isLoading: boolean } | undefined;

const Harness = ({ scope }: { scope: 'mine' | 'all' | 'late' }) => {
  latest = useDataStewardshipQueue('ws-1', 'data-entity', scope);
  return null;
};

describe('useDataStewardshipQueue', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.assignmentsMine.mockReset();
    mocks.casesList.mockReset();
    mocks.entityGet.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (scope: 'mine' | 'all' | 'late') => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness scope={scope} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('mine: uses assignments.mine and joins to the dataset entity', async () => {
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
    mocks.entityGet.mockResolvedValue(entity());

    render('mine');
    await flush();

    expect(latest?.items).toHaveLength(1);
    expect(latest?.items[0]?.dataset._name).toBe('Customer Records');
    expect(mocks.casesList).not.toHaveBeenCalled();
  });

  it('drops cases whose subject is not a Data Entity of the configured schema', async () => {
    mocks.assignmentsMine.mockResolvedValue([
      { assignment: null, case: governanceCase(), requiresAction: false }
    ]);
    mocks.entityGet.mockResolvedValue(
      entity({ _schema: { id: 'other-schema', name: 'Other Schema' } })
    );

    render('mine');
    await flush();

    expect(latest?.items).toHaveLength(0);
  });

  it('drops case kinds outside the Data Stewardship queue', async () => {
    mocks.assignmentsMine.mockResolvedValue([
      {
        assignment: null,
        case: governanceCase({ caseKind: 'document.status' }),
        requiresAction: false
      }
    ]);

    render('mine');
    await flush();

    expect(latest?.items).toHaveLength(0);
    expect(mocks.entityGet).not.toHaveBeenCalled();
  });

  it('all: uses governance.cases.list rather than assignments.mine', async () => {
    mocks.casesList.mockResolvedValue([governanceCase()]);
    mocks.entityGet.mockResolvedValue(entity());

    render('all');
    await flush();

    expect(latest?.items).toHaveLength(1);
    expect(latest?.items[0]?.assignment).toBeNull();
    expect(mocks.assignmentsMine).not.toHaveBeenCalled();
  });

  it('late: further narrows governance.cases.list to overdue cases', async () => {
    mocks.casesList.mockResolvedValue([
      governanceCase({ id: 'case-future', dueAt: '2099-01-01T00:00:00.000Z' }),
      governanceCase({ id: 'case-overdue', dueAt: '2000-01-01T00:00:00.000Z' })
    ]);
    mocks.entityGet.mockResolvedValue(entity());

    render('late');
    await flush();

    expect(latest?.items).toHaveLength(1);
    expect(latest?.items[0]?.case.id).toBe('case-overdue');
  });
});
