// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskDrawer } from './RiskDrawer';
import type { RiskComplianceConfig } from '../riskComplianceQueries';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityGet: vi.fn(),
  schemasList: vi.fn(),
  relationsListForEntity: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet },
    schemas: { list: mocks.schemasList },
    relations: { listForEntity: mocks.relationsListForEntity }
  }
}));

const riskConfig: RiskComplianceConfig = {
  riskSchemaId: 'risk',
  controlSchemaId: 'control',
  frameworkSchemaId: null,
  complianceRequirementSchemaId: null,
  dataEntitySchemaId: null
};

const riskSchema = {
  id: 'risk',
  name: 'Risk',
  fields: [
    { id: 'likelihood', name: 'Likelihood', type: 'number' },
    { id: 'impact', name: 'Impact', type: 'number' },
    { id: 'inherent_risk_score', name: 'Inherent Risk Score', type: 'derived' },
    {
      id: 'mitigation_effectiveness',
      name: 'Mitigation Effectiveness',
      type: 'select',
      options: [{ value: 'partial', label: 'Partial' }]
    },
    { id: 'residual_risk_score', name: 'Residual Risk Score', type: 'derived' },
    {
      id: 'category',
      name: 'Category',
      type: 'select',
      options: [{ value: 'security', label: 'Security' }]
    },
    {
      id: 'status',
      name: 'Status',
      type: 'select',
      options: [{ value: 'open', label: 'Open' }]
    },
    { id: 'risk_owner', name: 'Risk Owner', type: 'text' },
    { id: 'treatment_target_date', name: 'Treatment Target Date', type: 'date' },
    {
      id: 'affected_entities',
      name: 'Affects',
      type: 'typedRelation',
      relationSchemaId: 'risk-affects-rel',
      direction: 'in',
      minCount: 0,
      maxCount: -1
    },
    {
      id: 'mitigating_controls',
      name: 'Mitigated by',
      type: 'typedRelation',
      relationSchemaId: 'risk-control-rel',
      direction: 'in',
      minCount: 0,
      maxCount: -1
    }
  ]
};

describe('RiskDrawer', () => {
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
      _uid: 'risk-1',
      _publicId: 'RSK-001',
      _name: 'Customer Account Takeover',
      _schema: { id: 'risk', name: 'Risk' },
      _owner: null,
      _lifecycle: null,
      likelihood: 3,
      impact: 4,
      inherent_risk_score: 12,
      mitigation_effectiveness: 'partial',
      residual_risk_score: 9,
      category: 'security',
      status: 'open',
      risk_owner: 'Jane Doe',
      treatment_target_date: '2026-06-01'
    });
    mocks.schemasList.mockResolvedValue([riskSchema]);
    mocks.relationsListForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const flushUntilNoLoading = async () => {
    for (let i = 0; i < 8 && container.textContent?.includes('Loading risk'); i++) {
      await flush();
    }
    for (let i = 0; i < 8; i++) await flush();
  };

  const renderDrawer = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskDrawer
            workspaceSlug="ws-1"
            riskId="risk-1"
            riskConfig={riskConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    await flushUntilNoLoading();
  };

  it('shows attributes, risk profile band, and empty states for a risk with no relations', async () => {
    await renderDrawer();

    expect(container.textContent).toContain('Customer Account Takeover');
    expect(container.textContent).toContain('RSK-001');
    expect(container.textContent).toContain('Security');
    expect(container.textContent).toContain('Open');
    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toContain('No mitigating controls.');
    expect(container.textContent).toContain('No affected entities linked.');
    // residual_risk_score 9 -> medium band (5-9)
    expect(container.textContent).toContain('medium');
  });

  it('lists a mitigating control with its coverage and effectiveness, and computes rcCoverage', async () => {
    mocks.relationsListForEntity.mockResolvedValue({
      outgoing: [
        {
          _uid: 'rel-1',
          _schema: { id: 'risk-control-rel', name: 'Risk Mitigation' },
          _in: { id: 'risk-1', name: 'Customer Account Takeover', schemaId: 'risk' },
          _out: { id: 'control-1', name: 'MFA Enforcement', schemaId: 'control' },
          _owner: null,
          _lifecycle: null,
          coverage: 70,
          effectiveness: 'partial'
        }
      ],
      incoming: []
    });
    await renderDrawer();

    expect(container.textContent).toContain('MFA Enforcement');
    expect(container.textContent).toContain('35.0%'); // 70 * 0.5
    expect(container.textContent).toContain('partial');
  });

  it('lists an affected entity linked via risk-affects', async () => {
    mocks.relationsListForEntity.mockResolvedValue({
      outgoing: [
        {
          _uid: 'rel-2',
          _schema: { id: 'risk-affects-rel', name: 'Risk Affects' },
          _in: { id: 'risk-1', name: 'Customer Account Takeover', schemaId: 'risk' },
          _out: { id: 'sys-1', name: 'Payments System', schemaId: 'system' },
          _owner: null,
          _lifecycle: null
        }
      ],
      incoming: []
    });
    await renderDrawer();

    expect(container.textContent).toContain('Payments System');
    expect(container.textContent).not.toContain('No affected entities linked.');
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
      entityDetailRoute('ws-1', asEntityPublicId('RSK-001'))
    );
  });

  it('shows an unavailable state when the risk fails to load', async () => {
    mocks.entityGet.mockRejectedValue(new Error('not found'));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskDrawer
            workspaceSlug="ws-1"
            riskId="risk-1"
            riskConfig={riskConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    expect(container.textContent).toContain('This risk is unavailable.');
  });
});
