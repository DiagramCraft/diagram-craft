// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetricRollupResponse } from '@arch-register/api-types/metricContract';
import { CapabilityDrawer } from './CapabilityDrawer';
import type { StrategyModelConfig } from '../strategyQueries';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityGet: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  relationsForEntity: vi.fn(),
  metricsRollup: vi.fn(),
  lifecycleStatesList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { get: mocks.entityGet, list: mocks.entityList, tree: mocks.entityTree },
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
  businessCapabilitySchemaId: 'business_capability',
  objectiveSupportsBusinessCapabilityRelationSchemaId: 'objective-supports-business-capability-rel',
  businessCapabilitySupportsEntityRelationSchemaId: 'business-capability-supports-entity-rel'
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
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });
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

  it('lists direct children from the entity tree, resolved by uid rather than the route\'s public id', async () => {
    // Regression test, two bugs at once:
    // 1) Children used to come from an entities-query `parent equals capabilityId` filter, which
    //    never matches (`parent` is a containment field stored as a ref array, and the filter
    //    compiler only treats a field as array-shaped via `isMultiValuedScalarField`, which
    //    excludes containment fields entirely) — children now come from `entities.tree`'s edges,
    //    the same data the Capabilities sidebar's tree already relies on.
    // 2) The drawer's `capabilityId` prop is the route's *public* id (`openCapability` passes
    //    `entity._publicId`), but tree edges are keyed by internal uid — comparing edges against
    //    the raw prop instead of the loaded entity's `_uid` matched nothing for every capability.
    mocks.entityGet.mockResolvedValue({
      _uid: 'uid-cap-1',
      _publicId: 'CAP-001',
      _name: 'Customer Management',
      _schema: { id: 'business_capability', name: 'Business Capability' },
      _owner: null,
      _lifecycle: null,
      capability_level: 'L1'
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'uid-cap-1', _name: 'Customer Management', _slug: 'customer-management' },
        { _uid: 'uid-cap-2', _name: 'Account Management', _slug: 'account-management' }
      ],
      edges: [{ parentId: 'uid-cap-1', childId: 'uid-cap-2' }]
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CapabilityDrawer
            workspaceSlug="ws-1"
            capabilityId="CAP-001"
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

    expect(container.textContent).toContain('Account Management');
    expect(container.textContent).not.toContain('No child capabilities.');
    expect(mocks.metricsRollup).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ boxEntityIds: ['uid-cap-1'] }) })
    );
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
      entityDetailRoute('ws-1', asEntityPublicId('CAP-001'))
    );
  });
});
