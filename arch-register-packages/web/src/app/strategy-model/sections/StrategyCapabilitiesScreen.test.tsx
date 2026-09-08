// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyCapabilitiesScreen } from './StrategyCapabilitiesScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  metricsRollup: vi.fn(),
  teamsList: vi.fn(),
  capabilityConfigurationsList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ workspaceSlug: 'ws-1', capabilityId: undefined }),
  useSearch: () => ({}),
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, tree: mocks.entityTree, get: vi.fn() },
    relations: { listForEntity: vi.fn() },
    metrics: { rollup: mocks.metricsRollup },
    config: {
      teams: { list: mocks.teamsList },
      lifecycleStates: { list: vi.fn().mockResolvedValue([]) },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
  }
}));

const capability = (uid: string, name: string, level: string, ownerId: string | null) => ({
  _uid: uid,
  _publicId: uid.toUpperCase(),
  _name: name,
  _schema: { id: 'business_capability', name: 'Business Capability' },
  _owner: ownerId ? { id: ownerId, name: `Team ${ownerId}` } : null,
  _lifecycle: null,
  capability_level: level
});

describe('StrategyCapabilitiesScreen', () => {
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

    mocks.capabilityConfigurationsList.mockResolvedValue([
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
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        capability('cap-1', 'Customer Management', 'L1', 'team-a'),
        capability('cap-2', 'Order Management', 'L1', 'team-b'),
        capability('cap-3', 'Loyalty Programs', 'L2', 'team-a')
      ],
      total: 3
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'cap-1', _name: 'Customer Management', _slug: 'customer-management' },
        { _uid: 'cap-2', _name: 'Order Management', _slug: 'order-management' },
        { _uid: 'cap-3', _name: 'Loyalty Programs', _slug: 'loyalty-programs' }
      ],
      edges: [{ parentId: 'cap-1', childId: 'cap-3' }]
    });
    mocks.teamsList.mockResolvedValue([]);
    mocks.metricsRollup.mockImplementation(
      ({ body }: { body: { boxEntityIds: string[]; metric: { source: { fieldId: string } } } }) => {
        const { fieldId } = body.metric.source;
        const value = fieldId === 'maturity' ? 3 : fieldId === 'risk' ? 2 : 1;
        return Promise.resolve({
          results: body.boxEntityIds.map(boxEntityId => ({
            boxEntityId,
            value,
            lifecycleId: null,
            dominantValue: null,
            dominantLabel: null,
            distribution: [],
            sourceCount: 1,
            populatedCount: 1,
            duplicateCount: 0
          })),
          legend: { min: null, max: null }
        });
      }
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('renders every capability with its roll-up columns', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyCapabilitiesScreen />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading'); i++) {
      await flush();
    }

    expect(container.textContent).toContain('Customer Management');
    expect(container.textContent).toContain('Order Management');
    expect(container.textContent).toContain('CAP-1');
    expect(container.textContent).toContain('Team team-a');
    // The Level column reads `capability_level`, a schema `data` field that only the 'full' view
    // projects (`toApiEntitySummary` omits schema fields entirely) — regression test for the
    // table showing "—" for Level while the drawer's own full-entity fetch showed it correctly.
    expect(container.textContent).toContain('L1');
    expect(mocks.entityList).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ view: 'full' }) })
    );
  });

  it('sorts by name in tree order and indents by level when sorted by name', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyCapabilitiesScreen />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading'); i++) {
      await flush();
    }

    const nameCellFor = (name: string) =>
      [...container.querySelectorAll('td')].find(td => td.textContent?.includes(name));
    const indentedDiv = (name: string) => nameCellFor(name)?.querySelector('div');

    // Default sort is 'name', which is hierarchical (tree) order — 'Loyalty Programs' (cap-3) is a
    // child of 'Customer Management' (cap-1, per the mocked tree edges) so it sorts right after
    // its parent rather than alphabetically between 'Customer' and 'Order'.
    const rowNames = [...container.querySelectorAll('tbody tr')].map(
      tr => tr.querySelector('td')?.textContent
    );
    expect(rowNames.join('|')).toContain('Customer Management');
    const order = [...container.querySelectorAll('tbody tr')].map(tr => tr.textContent ?? '');
    const indexOf = (name: string) => order.findIndex(text => text.includes(name));
    expect(indexOf('Loyalty Programs')).toBe(indexOf('Customer Management') + 1);

    // L1 (no indent) vs L2 (one level in) — mirrors the design reference's
    // `BCMCapabilityList` (`bcm-views.jsx`), which indents the Name cell by `(level - 1)`.
    expect((indentedDiv('Customer Management') as HTMLElement)?.style.paddingLeft).toBe('');
    expect((indentedDiv('Loyalty Programs') as HTMLElement)?.style.paddingLeft).toBe('20px');
  });

  it('drops the tree indent once sorted by a column other than name', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyCapabilitiesScreen />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading'); i++) {
      await flush();
    }

    const sortSelect = [...container.querySelectorAll('select')].find(select =>
      [...select.options].some(option => option.value === 'maturity')
    ) as HTMLSelectElement;
    expect(sortSelect).toBeDefined();

    await act(async () => {
      sortSelect.value = 'maturity';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const nameCellFor = (name: string) =>
      [...container.querySelectorAll('td')].find(td => td.textContent?.includes(name));
    const indentedDiv = (name: string) => nameCellFor(name)?.querySelector('div');
    expect((indentedDiv('Loyalty Programs') as HTMLElement)?.style.paddingLeft).toBe('');
  });

  it('opens the capability drawer route when a row is clicked', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyCapabilitiesScreen />
        </QueryClientProvider>
      );
    });
    const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    for (let i = 0; i < 5 && container.textContent?.includes('Loading'); i++) {
      await flush();
    }

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Customer Management')
    );
    expect(row).toBeDefined();

    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/capabilities/$capabilityId',
        params: { workspaceSlug: 'ws-1', capabilityId: 'CAP-1' }
      })
    );
  });
});
