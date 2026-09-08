// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { CapabilityDrawer } from './CapabilityDrawer';
import type { StrategyModelConfig } from '../strategyQueries';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityGet: vi.fn(),
  entityList: vi.fn(),
  relationsForEntity: vi.fn(),
  metricsRollup: vi.fn(),
  lifecycleStatesList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet, list: mocks.entityList },
    relations: { listForEntity: mocks.relationsForEntity },
    metrics: { rollup: mocks.metricsRollup },
    config: { lifecycleStates: { list: mocks.lifecycleStatesList } }
  }
}));

const strategyConfig: StrategyModelConfig = {
  objectiveSchemaId: 'objective',
  outcomeSchemaId: 'outcome',
  initiativeSchemaId: 'initiative',
  measureSchemaId: 'measure',
  businessCapabilitySchemaId: 'business_capability'
};

const emptyRollup: MetricRollupResponse = {
  results: [
    {
      boxEntityId: 'cap-1',
      value: 3,
      lifecycleId: null,
      dominantValue: null,
      dominantLabel: null,
      distribution: [],
      sourceCount: 2,
      populatedCount: 2,
      duplicateCount: 0
    }
  ],
  legend: { min: null, max: null }
};

describe('CapabilityDrawer', () => {
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
      _uid: 'cap-1',
      _publicId: 'CAP-001',
      _name: 'Customer Management',
      _schema: { id: 'business_capability', name: 'Business Capability' },
      _owner: null,
      _lifecycle: null,
      capability_level: 'L1'
    });
    mocks.entityList.mockResolvedValue({ items: [], total: 0 });
    mocks.relationsForEntity.mockResolvedValue({ outgoing: [], incoming: [] });
    mocks.metricsRollup.mockResolvedValue(emptyRollup);
    mocks.lifecycleStatesList.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows attributes and an empty "Realized by" state for a capability with no direct links', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CapabilityDrawer
            workspaceSlug="ws-1"
            capabilityId="cap-1"
            strategyConfig={strategyConfig}
            onClose={vi.fn()}
            onOpenCapability={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading capability'); i++) {
      await flush();
    }

    expect(container.textContent).toContain('Customer Management');
    expect(container.textContent).toContain('CAP-001');
    expect(container.textContent).toContain('No owner assigned');
    expect(container.textContent).toContain('Business Capability');
    expect(container.textContent).toContain(
      'No directly linked applications. Non-leaf capabilities may only show links carried by'
    );
    expect(container.textContent).toContain('No linked objectives.');
    expect(container.textContent).toContain('No linked initiatives.');
  });

  it('navigates to the entity detail route when "Open record in Entities" is clicked', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CapabilityDrawer
            workspaceSlug="ws-1"
            capabilityId="cap-1"
            strategyConfig={strategyConfig}
            onClose={vi.fn()}
            onOpenCapability={vi.fn()}
          />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading capability'); i++) {
      await flush();
    }

    const footerButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Open record in Entities'
    );
    expect(footerButton).toBeDefined();

    await act(async () => {
      footerButton!.click();
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/entities/$entityId',
        params: { workspaceSlug: 'ws-1', entityId: 'CAP-001' }
      })
    );
  });
});
