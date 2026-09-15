// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlDrawer } from './ControlDrawer';
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

const controlSchema = {
  id: 'control',
  name: 'Control',
  fields: [
    {
      id: 'control_type',
      name: 'Type',
      type: 'select',
      options: [{ value: 'preventive', label: 'Preventive' }]
    },
    {
      id: 'design_effectiveness',
      name: 'Design Effectiveness',
      type: 'select',
      options: [{ value: 'effective', label: 'Effective' }]
    },
    {
      id: 'operating_effectiveness',
      name: 'Operating Effectiveness',
      type: 'select',
      options: [{ value: 'effective', label: 'Effective' }]
    },
    { id: 'last_verified', name: 'Last Verified', type: 'date' },
    {
      id: 'mitigated_risks',
      name: 'Mitigates',
      type: 'typedRelation',
      relationSchemaId: 'risk-control-rel',
      direction: 'out',
      minCount: 0,
      maxCount: -1
    },
    {
      id: 'protected_entities',
      name: 'Protects',
      type: 'typedRelation',
      relationSchemaId: 'control-affects-rel',
      direction: 'in',
      minCount: 0,
      maxCount: -1
    }
  ]
};

describe('ControlDrawer', () => {
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
      _uid: 'control-1',
      _publicId: 'CTL-001',
      _name: 'MFA Enforcement',
      _schema: { id: 'control', name: 'Control' },
      _owner: null,
      _lifecycle: null,
      control_type: 'preventive',
      design_effectiveness: 'effective',
      operating_effectiveness: 'effective',
      last_verified: '2026-01-01'
    });
    mocks.schemasList.mockResolvedValue([controlSchema]);
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
    for (let i = 0; i < 8 && container.textContent?.includes('Loading control'); i++) {
      await flush();
    }
    for (let i = 0; i < 8; i++) await flush();
  };

  const renderDrawer = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ControlDrawer
            workspaceSlug="ws-1"
            controlId="control-1"
            riskConfig={riskConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    await flushUntilNoLoading();
  };

  it('shows attributes and empty states for a control with no relations', async () => {
    await renderDrawer();

    expect(container.textContent).toContain('MFA Enforcement');
    expect(container.textContent).toContain('CTL-001');
    expect(container.textContent).toContain('Preventive');
    expect(container.textContent).toContain('Effective');
    expect(container.textContent).toContain('No risks mitigated.');
    expect(container.textContent).toContain('No protected entities linked.');
  });

  it('lists a mitigated risk with its coverage/effectiveness for this control', async () => {
    mocks.relationsListForEntity.mockResolvedValue({
      outgoing: [],
      incoming: [
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
      ]
    });
    await renderDrawer();

    expect(container.textContent).toContain('Customer Account Takeover');
    expect(container.textContent).toContain('70%');
    expect(container.textContent).toContain('partial');
  });

  it('lists a protected entity linked via control-affects', async () => {
    mocks.relationsListForEntity.mockResolvedValue({
      outgoing: [
        {
          _uid: 'rel-2',
          _schema: { id: 'control-affects-rel', name: 'Control Protection' },
          _in: { id: 'control-1', name: 'MFA Enforcement', schemaId: 'control' },
          _out: { id: 'sys-1', name: 'Payments System', schemaId: 'system' },
          _owner: null,
          _lifecycle: null
        }
      ],
      incoming: []
    });
    await renderDrawer();

    expect(container.textContent).toContain('Payments System');
    expect(container.textContent).not.toContain('No protected entities linked.');
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
      entityDetailRoute('ws-1', asEntityPublicId('CTL-001'))
    );
  });

  it('shows an unavailable state when the control fails to load', async () => {
    mocks.entityGet.mockRejectedValue(new Error('not found'));
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ControlDrawer
            workspaceSlug="ws-1"
            controlId="control-1"
            riskConfig={riskConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();

    expect(container.textContent).toContain('This control is unavailable.');
  });
});
