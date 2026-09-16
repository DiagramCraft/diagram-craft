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
  schemasList: vi.fn(),
  changeCasesListByEntity: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    changeCases: { listByEntity: mocks.changeCasesListByEntity }
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
    { id: 'permitted_residency_regions', name: 'Permitted Residency Regions', type: 'select', options: [] }
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
    expect(container.textContent).toContain('Not yet available — queue items ship with #3298.');
    expect(container.textContent).toContain('Not yet available — exceptions/waivers ship with #3301.');
    expect(container.textContent).toContain('Not yet available — assessments ship with #3302.');
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
