// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { RiskComplianceAssessmentsScreen } from './RiskComplianceAssessmentsScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  schemasList: vi.fn(),
  assessmentsList: vi.fn(),
  projectsList: vi.fn(),
  entityList: vi.fn(),
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
    schemas: { list: mocks.schemasList },
    assessments: { list: mocks.assessmentsList },
    projects: { list: mocks.projectsList },
    entities: { list: mocks.entityList },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const CONFIG = {
  type: 'risk-compliance',
  valid: true,
  bindings: {
    risk: { target: { kind: 'entity_schema', id: 'risk' } },
    control: { target: { kind: 'entity_schema', id: 'control' } }
  }
};

const baseAssessment = {
  workspace: 'ws-1',
  description: '',
  mode: 'fields' as const,
  assessment_type_id: null,
  scope_conditions: [],
  fields: [],
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

describe('RiskComplianceAssessmentsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskComplianceAssessmentsScreen />
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
    mocks.schemasList.mockResolvedValue([
      { id: 'risk', name: 'Risk', fields: [] },
      { id: 'control', name: 'Control', fields: [] }
    ]);
    mocks.projectsList.mockResolvedValue([
      { id: 'proj-1', public_id: 'PRJ-001', name: 'Q1 Reviews' }
    ]);
    mocks.assessmentsList.mockResolvedValue([
      {
        ...baseAssessment,
        id: 'assess-1',
        project_id: 'proj-1',
        name: 'Quarterly risk review',
        status: 'open',
        scope: ['risk'],
        due_at: '2026-01-15T00:00:00.000Z'
      },
      {
        ...baseAssessment,
        id: 'assess-2',
        project_id: 'proj-1',
        name: 'Annual control test',
        status: 'open',
        scope: ['control'],
        due_at: '2026-02-01T00:00:00.000Z'
      }
    ]);
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.navigate.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('lists assessments scoped to Risk and Control and shows due-soon panels', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Quarterly risk review');
    expect(container.textContent).toContain('Annual control test');
    expect(container.textContent).toContain('Risk reviews due');
    expect(container.textContent).toContain('Control tests due');
    // Day-count due labels (e.g. "d late"), not a plain formatted date — see `assessmentDueTone.ts`.
    expect(container.textContent).toMatch(/d late/);
  });

  it('navigates to the owning project on register row click', async () => {
    await renderScreen();
    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Quarterly risk review')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining(
        projectDetailRoute('ws-1', asProjectPublicId('PRJ-001'), {
          section: 'assessments',
          assessmentId: 'assess-1'
        })
      )
    );
  });

  it('navigates to the owning project on a due-panel row click', async () => {
    await renderScreen();
    mocks.navigate.mockClear();
    const row = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Annual control test')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining(
        projectDetailRoute('ws-1', asProjectPublicId('PRJ-001'), {
          section: 'assessments',
          assessmentId: 'assess-2'
        })
      )
    );
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Risk & Compliance is not enabled.');
  });
});
