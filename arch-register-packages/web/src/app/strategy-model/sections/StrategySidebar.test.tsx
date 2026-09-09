// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategySidebar } from './StrategySidebar';
import {
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_HEATMAPS_ID,
  STRATEGY_STRATEGY_ID
} from '../strategySections';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  schemaList: vi.fn(),
  capabilityConfigurationsList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => ({})
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, tree: mocks.entityTree },
    schemas: { list: mocks.schemaList },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const validConfig = [
  {
    type: 'strategy-model',
    valid: true,
    bindings: {
      objective: { target: { kind: 'entity_schema', id: 'objective' } },
      outcome: { target: { kind: 'entity_schema', id: 'outcome' } },
      initiative: { target: { kind: 'entity_schema', id: 'initiative' } },
      measure: { target: { kind: 'entity_schema', id: 'measure' } },
      business_capability: { target: { kind: 'entity_schema', id: 'business_capability' } },
      objective_supports_business_capability: {
        target: { kind: 'relation_schema', id: 'objective-supports-business-capability-rel' }
      },
      business_capability_supports_entity: {
        target: { kind: 'relation_schema', id: 'business-capability-supports-entity-rel' }
      }
    }
  }
];

describe('StrategySidebar', () => {
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

    mocks.capabilityConfigurationsList.mockResolvedValue(validConfig);
    mocks.schemaList.mockResolvedValue([
      { id: 'business_capability', name: 'Business Capability', icon: 'globe', color: null },
      { id: 'objective', name: 'Objective', icon: 'target', color: null }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'cap-1',
          _publicId: 'CAP-1',
          _name: 'Customer Management',
          _owner: { id: 'team-a', name: 'Team A' }
        }
      ],
      total: 1
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'cap-1', _name: 'Customer Management', _slug: 'customer-management' },
        { _uid: 'cap-2', _name: 'Order Management', _slug: 'order-management' }
      ],
      edges: [{ parentId: 'cap-1', childId: 'cap-2' }]
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

  it('shows the section nav list for a non-Capabilities section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_HEATMAPS_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('Sections');
    expect(container.textContent).toContain('Capability map');
    expect(container.textContent).not.toContain('Hierarchy');
  });

  it('shows the capability tree and owner facet for the Capabilities section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_CAPABILITIES_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('All capabilities');
    expect(container.textContent).toContain('Hierarchy');
    expect(container.textContent).toContain('Customer Management');
    expect(container.textContent).toContain('Team A');
    expect(container.textContent).not.toContain('Sections');
  });

  it('shows the owner facet and hierarchy for the Capability map section', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_CAPABILITY_MAP_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('All domains');
    expect(container.textContent).toContain('Hierarchy');
    expect(container.textContent).toContain('Customer Management');
    expect(container.textContent).not.toContain('Sections');
  });

  it('focuses the map on a capability when a map tree row is clicked', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_CAPABILITY_MAP_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    const row = [
      ...container.querySelectorAll('[data-testid="strategy-capability-tree-cap-1"]')
    ][0];
    expect(row).toBeDefined();

    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/map',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('lists objectives for the Strategy section and selects one on click', async () => {
    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'objective') {
        return Promise.resolve({
          items: [{ _uid: 'obj-1', _publicId: 'OBJ-1', _name: 'Grow Revenue' }],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_STRATEGY_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    expect(container.textContent).toContain('Objectives');
    expect(container.textContent).toContain('Grow Revenue');
    expect(container.textContent).not.toContain('Initiatives');
    expect(container.textContent).not.toContain('Sections');

    const objectiveRow = container.querySelector('[data-testid="strategy-objective-obj-1"]');
    await act(async () => {
      objectiveRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const call = mocks.navigate.mock.calls.find(([arg]) => typeof arg?.search === 'function');
    expect(call![0].search({})).toEqual(expect.objectContaining({ objective: 'obj-1' }));
  });

  it('filters to a capability subtree when a tree row is clicked', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategySidebar workspaceSlug="ws-1" activeSection={STRATEGY_CAPABILITIES_ID} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 5; i++) await flush();

    const row = [
      ...container.querySelectorAll('[data-testid="strategy-capability-tree-cap-1"]')
    ][0];
    expect(row).toBeDefined();

    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/capabilities',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });
});
