// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractDrawer } from './ContractDrawer';
import type { VendorManagementConfig } from '../vendorManagementQueries';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), entityGet: vi.fn(), schemasList: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet },
    schemas: { list: mocks.schemasList }
  }
}));

const vendorConfig: VendorManagementConfig = {
  vendorSchemaId: 'vendor',
  contractSchemaId: 'contract'
};

const contractSchema = {
  id: 'contract',
  name: 'Contract',
  fields: [
    { id: 'contract_start', name: 'Contract Start', type: 'date' },
    { id: 'contract_end', name: 'Contract End', type: 'date' },
    {
      id: 'contract_type',
      name: 'Contract Type',
      type: 'select',
      options: [{ value: 'licence', label: 'Licence' }]
    },
    { id: 'notice_period_days', name: 'Notice Period (Days)', type: 'number' },
    { id: 'auto_renew', name: 'Auto-Renew', type: 'boolean' },
    { id: 'contract_owner', name: 'Contract Owner', type: 'text' },
    { id: 'annual_cost', name: 'Annual Cost', type: 'currency' },
    { id: 'setup_fee', name: 'Setup Fee', type: 'currency' }
  ]
};

const CONTRACT = {
  _uid: 'ctr-1',
  _publicId: 'CTR-001',
  _name: 'Acme Support',
  contract_type: 'licence',
  contract_start: '2026-01-01',
  contract_end: '2026-10-01',
  notice_period_days: 30,
  auto_renew: true,
  contract_owner: 'Jane Doe',
  annual_cost: { amount: 1000, currency: 'USD' },
  setup_fee: { amount: 100, currency: 'USD' },
  vendor: ['vnd-1'],
  system: ['sys-1']
};

describe('ContractDrawer', () => {
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

    mocks.schemasList.mockResolvedValue([contractSchema]);
    mocks.entityGet.mockImplementation(({ params }: { params: { id: string } }) => {
      if (params.id === 'ctr-1') return Promise.resolve(CONTRACT);
      if (params.id === 'vnd-1') {
        return Promise.resolve({ _uid: 'vnd-1', _publicId: 'VND-001', _name: 'Acme Corp' });
      }
      if (params.id === 'sys-1') {
        return Promise.resolve({ _uid: 'sys-1', _publicId: 'SYS-001', _name: 'Billing System' });
      }
      return Promise.reject(new Error(`unexpected id ${params.id}`));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderDrawer = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ContractDrawer
            workspaceSlug="ws-1"
            contractId="ctr-1"
            vendorConfig={vendorConfig}
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();
  };

  it('shows terms, cost, vendor, and systems used', async () => {
    await renderDrawer();

    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).toContain('CTR-001');
    expect(container.textContent).toContain('Jane Doe');
    expect(container.textContent).toContain('Acme Corp');
    expect(container.textContent).toContain('Billing System');
  });

  it('navigates to the vendor drawer when the Vendor row is clicked', async () => {
    await renderDrawer();

    const vendorRow = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Acme Corp')
    );
    expect(vendorRow).toBeDefined();
    await act(async () => {
      vendorRow!.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/vendor-management/vendors/$vendorId',
        params: { workspaceSlug: 'ws-1', vendorId: 'VND-001' }
      })
    );
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
      entityDetailRoute('ws-1', asEntityPublicId('CTR-001'))
    );
  });

  it('shows an unavailable state when the contract fails to load', async () => {
    mocks.entityGet.mockImplementation(({ params }: { params: { id: string } }) =>
      params.id === 'ctr-1' ? Promise.reject(new Error('not found')) : Promise.resolve(undefined)
    );
    await renderDrawer();

    expect(container.textContent).toContain('This contract is unavailable.');
  });
});
