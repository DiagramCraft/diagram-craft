// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipSidebar } from './DataStewardshipSidebar';
import {
  DS_ASSESSMENTS_ID,
  DS_CHANGE_CASES_ID,
  DS_CLASSIFICATION_ID,
  DS_MY_WORK_ID,
  DS_STEWARDSHIP_ID,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationSchemasList: vi.fn(),
  assessmentsList: vi.fn(),
  assessmentResponsesList: vi.fn(),
  assessmentTypesList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  assignmentsMine: vi.fn(),
  casesList: vi.fn(),
  membersList: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    relationSchemas: { list: mocks.relationSchemasList },
    assessments: { list: mocks.assessmentsList },
    assessmentResponses: { list: mocks.assessmentResponsesList },
    governance: {
      assignments: { mine: mocks.assignmentsMine },
      cases: { list: mocks.casesList }
    },
    config: {
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList },
      assessmentTypes: { list: mocks.assessmentTypesList },
      members: { list: mocks.membersList }
    }
  }
}));

// Same rationale as the entity drawer integration: member/team resolution needs a full
// WorkspaceContext provider out of scope for this component test.
vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => (principal: { principal_id?: string } | null | undefined) =>
    principal?.principal_id ? `Principal ${principal.principal_id}` : undefined
}));

const CONFIG = {
  type: 'data-stewardship',
  valid: true,
  bindings: { dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } } }
};

describe('DataStewardshipSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderSidebar = async (activeSection: DataStewardshipRailItemId = DS_STEWARDSHIP_ID) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipSidebar workspaceSlug="ws-1" activeSection={activeSection} />
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
    mocks.relationSchemasList.mockResolvedValue([]);
    mocks.schemasList.mockResolvedValue([
      {
        id: 'data-entity',
        name: 'Data Entity',
        fields: [
          {
            id: 'classification',
            name: 'Classification',
            type: 'select',
            options: [{ value: 'confidential', label: 'Confidential' }]
          }
        ]
      }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer Records',
          classification: 'confidential'
        }
      ],
      total: 1
    });
    mocks.assessmentsList.mockResolvedValue([]);
    mocks.assessmentResponsesList.mockResolvedValue([]);
    mocks.assessmentTypesList.mockResolvedValue([]);
    mocks.assignmentsMine.mockResolvedValue([]);
    mocks.casesList.mockResolvedValue([]);
    mocks.membersList.mockResolvedValue([]);
    mocks.entityGet.mockResolvedValue(null);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('renders Stewardship facets — gap toggle and classification counts, but no dataset list', async () => {
    await renderSidebar(DS_STEWARDSHIP_ID);
    expect(container.textContent).toContain('All datasets');
    expect(container.textContent).toContain('With a coverage gap');
    expect(container.textContent).toContain('Confidential');
    expect(container.textContent).not.toContain('Customer Records');
  });

  it('narrows to a classification when its facet is clicked', async () => {
    await renderSidebar(DS_STEWARDSHIP_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-facet-classification-confidential"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/stewardship',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders Change cases & exceptions facets — an all-cases toggle plus a status facet', async () => {
    mocks.casesList.mockResolvedValue([
      {
        id: 'case-1',
        workspace: 'ws-1',
        caseKind: 'entity.change-case',
        subjectType: 'entity',
        subjectId: 'ds-1',
        subjectVersion: null,
        status: 'open',
        outcome: null,
        policyVersion: null,
        initiatorUserId: null,
        parentCaseId: null,
        selfApprovalAllowed: false,
        payload: { entityId: 'ds-1' },
        initiationFields: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        dueAt: null,
        completedAt: null,
        cancelledAt: null,
        escalatedAt: null
      }
    ]);
    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-1',
      _publicId: 'DS-001',
      _name: 'Customer Records',
      _schema: { id: 'data-entity', name: 'Data Entity' }
    });

    await renderSidebar(DS_CHANGE_CASES_ID);
    expect(container.textContent).toContain('All change cases');
    expect(container.textContent).toContain('open');
  });

  it('narrows to a status when its Change cases facet is clicked', async () => {
    await renderSidebar(DS_CHANGE_CASES_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-change-cases-facet-status-open"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/change-cases',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders My work scope facets with counts, defaulting to Assigned to me', async () => {
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
        case: {
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
          escalatedAt: null
        },
        requiresAction: true
      }
    ]);
    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-1',
      _publicId: 'DS-001',
      _name: 'Customer Records',
      _schema: { id: 'data-entity', name: 'Data Entity' }
    });

    await renderSidebar(DS_MY_WORK_ID);
    expect(container.textContent).toContain('Assigned to me');
    expect(container.textContent).toContain('All open items');
    expect(container.textContent).toContain('Past due');
    expect(container.textContent).toContain('Kind');
    expect(container.textContent).toContain('Date reminder');
  });

  it('narrows to a priority when its My work facet is clicked', async () => {
    await renderSidebar(DS_MY_WORK_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-my-work-facet-priority-low"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderSidebar(DS_STEWARDSHIP_ID);
    expect(container.textContent).toContain('Data stewardship is not enabled.');
  });

  it('renders Classification facets — same shape as Stewardship, plus a personal-data toggle', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    expect(container.textContent).toContain('All datasets');
    expect(container.textContent).toContain('With a coverage gap');
    expect(container.textContent).toContain('Holds personal data');
    expect(container.textContent).toContain('Confidential');
    expect(container.textContent).not.toContain('Customer Records');
  });

  it('narrows to a classification when its Classification facet is clicked', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-classification-facet-confidential"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('renders Assessments facets — All plus a count per status bucket', async () => {
    mocks.assessmentsList.mockResolvedValue([
      {
        id: 'assess-1',
        workspace: 'ws-1',
        project_id: 'proj-1',
        name: 'DPIA — loyalty profiling',
        description: '',
        status: 'open',
        mode: 'fields',
        assessment_type_id: null,
        scope: ['data-entity'],
        scope_conditions: [],
        fields: [],
        groups: [],
        assigned_team_ids: [],
        due_at: '2020-01-01T00:00:00.000Z',
        recurrence: { type: 'none' },
        response_window_days: null,
        current_occurrence: 1,
        next_occurrence_at: null,
        response_count: 0,
        completed_entity_count: 0,
        team_acknowledge_status: [],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ]);
    await renderSidebar(DS_ASSESSMENTS_ID);
    expect(container.textContent).toContain('All');
    expect(container.textContent).toContain('Overdue');
    expect(container.textContent).toContain('In progress');
    expect(container.textContent).toContain('Not started');
    expect(container.textContent).toContain('Complete');
  });

  it('narrows to a status when its Assessments facet is clicked', async () => {
    await renderSidebar(DS_ASSESSMENTS_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-assessments-facet-overdue"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/assessments',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('toggles the personal-data facet', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-classification-facet-personal"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });
});
