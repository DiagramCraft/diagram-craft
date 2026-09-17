// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatasetDrawer } from './DatasetDrawer';
import type { DataStewardshipConfig } from '../dataStewardshipQueries';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityGet: vi.fn(),
  entityList: vi.fn(),
  schemasList: vi.fn(),
  changeCasesListByEntity: vi.fn(),
  assessmentsList: vi.fn(),
  assessmentResponsesList: vi.fn(),
  assessmentTypesList: vi.fn(),
  casesList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet, list: mocks.entityList },
    schemas: { list: mocks.schemasList },
    changeCases: { listByEntity: mocks.changeCasesListByEntity },
    assessments: { list: mocks.assessmentsList },
    assessmentResponses: { list: mocks.assessmentResponsesList },
    governance: { cases: { list: mocks.casesList } },
    config: { assessmentTypes: { list: mocks.assessmentTypesList } }
  }
}));

// Principal-name resolution (member/team lookup) needs a full WorkspaceContext provider that's
// out of scope for this component test — the drawer's own field-value rendering is what's under
// test, so stub the resolver deterministically instead of standing up that provider tree.
vi.mock('../../../hooks/usePrincipalLabel', () => ({
  usePrincipalLabel: () => (principal: { principal_id?: string } | null | undefined) =>
    principal?.principal_id ? `Principal ${principal.principal_id}` : undefined
}));

const dataStewardshipConfig: DataStewardshipConfig = { dataEntitySchemaId: 'data-entity' };

const dataEntitySchema = {
  id: 'data-entity',
  name: 'Data Entity',
  fields: [
    {
      id: 'classification',
      name: 'Classification',
      type: 'select',
      options: [{ value: 'confidential', label: 'Confidential' }]
    },
    { id: 'retention_policy', name: 'Retention Policy', type: 'typedRelation' },
    { id: 'review_date', name: 'Review Date', type: 'date' },
    {
      id: 'review_status',
      name: 'Review Status',
      type: 'derived',
      options: [{ value: 'current', label: 'Current' }]
    },
    {
      id: 'stewardship_status',
      name: 'Stewardship Status',
      type: 'derived',
      options: [{ value: 'complete', label: 'Complete' }]
    },
    { id: 'regulatory_tags', name: 'Regulatory Tags', type: 'select', options: [] },
    { id: 'processing_purposes', name: 'Processing Purposes', type: 'select', options: [] },
    {
      id: 'permitted_residency_regions',
      name: 'Permitted Residency Regions',
      type: 'select',
      options: []
    }
  ]
};

describe('DatasetDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-1',
      _publicId: 'DS-001',
      _name: 'Customer Records',
      _schema: { id: 'data-entity', name: 'Data Entity' },
      _owner: { id: 'team-1', name: 'Payments' },
      _lifecycle: null,
      classification: 'confidential',
      retention_policy: null,
      steward: { principal_type: 'user', principal_id: 'user-1' },
      custodian: null,
      review_date: '2026-01-01',
      review_status: 'current',
      stewardship_status: 'incomplete',
      regulatory_tags: [],
      processing_purposes: [],
      permitted_residency_regions: []
    });
    mocks.schemasList.mockResolvedValue([dataEntitySchema]);
    mocks.changeCasesListByEntity.mockResolvedValue([]);
    mocks.assessmentsList.mockResolvedValue([]);
    mocks.assessmentResponsesList.mockResolvedValue([]);
    mocks.assessmentTypesList.mockResolvedValue([]);
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.casesList.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const flushUntilNoLoading = async () => {
    for (let i = 0; i < 8 && container.textContent?.includes('Loading dataset'); i++) {
      await flush();
    }
    for (let i = 0; i < 8; i++) await flush();
  };

  const renderDrawer = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DatasetDrawer
            workspaceSlug="ws-1"
            datasetId="ds-1"
            dataStewardshipConfig={dataStewardshipConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    await flushUntilNoLoading();
  };

  it('shows attributes, stewardship, and a fully covered dataset', async () => {
    await renderDrawer();

    expect(container.textContent).toContain('Customer Records');
    expect(container.textContent).toContain('DS-001');
    expect(container.textContent).toContain('Confidential');
    expect(container.textContent).toContain('Payments');
    expect(container.textContent).toContain('Principal user-1');
    expect(container.textContent).toContain('Yes'); // dsCovered
    expect(container.textContent).toContain('No change cases linked.');
    expect(container.textContent).toContain('Nothing in the queue against this dataset.');
    expect(container.textContent).toContain(
      'Not yet available — exceptions/waivers ship with #3301.'
    );
    expect(container.textContent).toContain('No assessments target this dataset.');
    expect(container.textContent).toContain('API & Integration Catalog');
  });

  it('lists coverage gaps for an incomplete dataset', async () => {
    mocks.entityGet.mockResolvedValue({
      _uid: 'ds-2',
      _publicId: 'DS-002',
      _name: 'Legacy Extract',
      _schema: { id: 'data-entity', name: 'Data Entity' },
      _owner: null,
      _lifecycle: null,
      classification: null,
      steward: null,
      custodian: null,
      review_status: 'overdue'
    });
    await renderDrawer();

    expect(container.textContent).toContain('No'); // dsCovered
    expect(container.textContent).toContain('No named owner');
    expect(container.textContent).toContain('No named steward');
    expect(container.textContent).toContain('Classification not confirmed');
    expect(container.textContent).toContain('Review not current');
  });

  it('lists linked change cases', async () => {
    mocks.changeCasesListByEntity.mockResolvedValue([
      { id: 'case-1', name: 'Reclassify to restricted', status: 'draft' }
    ]);
    await renderDrawer();

    expect(container.textContent).toContain('Reclassify to restricted');
    expect(container.textContent).not.toContain('No change cases linked.');
  });

  it('lists assessments scoped to this dataset', async () => {
    mocks.assessmentsList.mockResolvedValue([
      {
        id: 'assess-1',
        workspace: 'ws-1',
        project_id: 'proj-1',
        name: 'DPIA — customer profile',
        description: '',
        status: 'open',
        mode: 'fields',
        assessment_type_id: 'type-dpia',
        scope: ['data-entity'],
        scope_conditions: [],
        fields: [],
        groups: [],
        assigned_team_ids: [],
        due_at: '2099-01-01T00:00:00.000Z',
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
    mocks.entityList.mockResolvedValue({
      items: [{ _uid: 'ds-1', _publicId: 'DS-001', _name: 'Customer Records', _owner: null }],
      total: 1
    });
    await renderDrawer();

    // No required fields, so `computeAssessmentStatus` reports Complete trivially.
    expect(container.textContent).toContain('DPIA — Complete');
    expect(container.textContent).not.toContain('No assessments target this dataset.');
  });

  it('lists open queue items for this dataset and opens the case drawer on click', async () => {
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
        payload: {},
        initiationFields: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        dueAt: null,
        completedAt: null,
        cancelledAt: null,
        escalatedAt: null
      }
    ]);
    const onOpenCase = vi.fn();
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DatasetDrawer
            workspaceSlug="ws-1"
            datasetId="ds-1"
            dataStewardshipConfig={dataStewardshipConfig}
            onClose={vi.fn()}
            onOpenCase={onOpenCase}
          />
        </QueryClientProvider>
      );
    });
    await flushUntilNoLoading();

    expect(container.textContent).toContain('Queue items — 1');
    expect(container.textContent).toContain('Entity Change Case');
    const queueButton = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Entity Change Case')
    );
    expect(queueButton).toBeDefined();
    await act(async () => queueButton!.click());
    expect(onOpenCase).toHaveBeenCalledWith('case-1');
  });

  it('navigates to the entity detail route when "Open record in Entities" is clicked', async () => {
    await renderDrawer();

    const footerButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Open record in Entities'
    );
    expect(footerButton).toBeDefined();

    await act(async () => {
      footerButton!.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      entityDetailRoute('ws-1', asEntityPublicId('DS-001'))
    );
  });

  it('shows an unavailable state when the dataset fails to load', async () => {
    mocks.entityGet.mockRejectedValue(new Error('not found'));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DatasetDrawer
            workspaceSlug="ws-1"
            datasetId="ds-1"
            dataStewardshipConfig={dataStewardshipConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    expect(container.textContent).toContain('This dataset is unavailable.');
  });
});
