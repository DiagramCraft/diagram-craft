// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipAssessmentsScreen } from './DataStewardshipAssessmentsScreen';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  assessmentsList: vi.fn(),
  assessmentResponsesList: vi.fn(),
  assessmentTypesList: vi.fn(),
  projectsList: vi.fn(),
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
    entities: { list: mocks.entityList },
    assessments: { list: mocks.assessmentsList },
    assessmentResponses: { list: mocks.assessmentResponsesList },
    projects: { list: mocks.projectsList },
    config: {
      assessmentTypes: { list: mocks.assessmentTypesList },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
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

const baseAssessment = {
  workspace: 'ws-1',
  project_id: 'proj-1',
  description: '',
  mode: 'fields' as const,
  scope: ['data-entity'],
  scope_conditions: [],
  groups: [],
  assigned_team_ids: [],
  recurrence: { type: 'none' as const },
  response_window_days: null,
  current_occurrence: 1,
  next_occurrence_at: null,
  response_count: 0,
  completed_entity_count: 0,
  team_acknowledge_status: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('DataStewardshipAssessmentsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipAssessmentsScreen />
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
    mocks.assessmentTypesList.mockResolvedValue([
      {
        id: 'type-dpia',
        workspace: 'ws-1',
        name: 'DPIA',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ]);
    mocks.projectsList.mockResolvedValue([
      { id: 'proj-1', public_id: 'DW-1', workspace: 'ws-1', name: 'Checkout Revamp' }
    ]);
    mocks.assessmentsList.mockResolvedValue([
      {
        ...baseAssessment,
        id: 'assess-1',
        name: 'DPIA — loyalty profiling',
        description: 'Assess profiling risk across every governed dataset.',
        status: 'open',
        assessment_type_id: 'type-dpia',
        fields: [{ id: 'q1', label: 'Q1', requirementLevel: 'required', type: 'text' }],
        completed_entity_count: 0,
        due_at: '2020-01-01T00:00:00.000Z' // past due — an open, incomplete row here is "overdue"
      },
      {
        ...baseAssessment,
        id: 'assess-2',
        name: 'Records survey — orders',
        status: 'open',
        assessment_type_id: null,
        fields: [],
        completed_entity_count: 1, // matches the single in-scope dataset below — fully complete
        due_at: '2099-01-01T00:00:00.000Z'
      }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer profile',
          _owner: { id: 'team-1', name: 'Marketing' },
          steward: null
        }
      ],
      total: 1
    });
    mocks.assessmentResponsesList.mockResolvedValue([]);
    mocks.navigate.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists one row per assessment with kind, project, description, and no findings column', async () => {
    await renderScreen();
    expect(container.textContent).toContain('DPIA — loyalty profiling');
    expect(container.textContent).toContain('Assess profiling risk across every governed dataset.');
    expect(container.textContent).toContain('Records survey — orders');
    expect(container.textContent).toContain('DPIA');
    expect(container.textContent).toContain('Uncategorized');
    expect(container.textContent).toContain('Checkout Revamp');
    expect(container.textContent).not.toMatch(/Findings/);
    // No per-dataset join columns — a row is one assessment, not one (assessment, dataset) pair.
    expect(container.textContent).not.toContain('Customer profile');
    expect(container.textContent).not.toContain('Marketing');
  });

  it('shows the past-due incomplete assessment as Overdue in the stat strip and table', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('DPIA — loyalty profiling')
    );
    expect(row?.textContent).toContain('Overdue');
    expect(container.textContent).toContain('Overdue');
  });

  it('filters by status via the toolbar toggle', async () => {
    mocks.search = { status: 'complete' };
    await renderScreen();
    expect(container.textContent).toContain('Records survey — orders');
    expect(container.textContent).not.toContain('DPIA — loyalty profiling');
  });

  it('opens the assessment (its owning project, deep-linked) on row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('DPIA — loyalty profiling')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining(
        projectDetailRoute('ws-1', asProjectPublicId('DW-1'), {
          section: 'assessments',
          assessmentId: 'assess-1'
        })
      )
    );
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Data stewardship is not enabled.');
  });
});
