// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyStrategyScreen } from './StrategyStrategyScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { objective: undefined as string | undefined },
  entityList: vi.fn(),
  entityTree: vi.fn(),
  relationList: vi.fn(),
  metricRollup: vi.fn(),
  capabilityConfigurationsList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ workspaceSlug: 'ws-1', capabilityId: undefined }),
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../components/EntityHoverCard', () => ({
  EntityHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: vi.fn(), tree: mocks.entityTree },
    relations: { list: mocks.relationList, listForEntity: vi.fn() },
    metrics: { rollup: mocks.metricRollup },
    config: {
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
  }
}));

const CONFIG = {
  type: 'strategy-model',
  valid: true,
  bindings: {
    objective: { target: { kind: 'entity_schema', id: 'objective' } },
    outcome: { target: { kind: 'entity_schema', id: 'outcome' } },
    initiative: { target: { kind: 'entity_schema', id: 'initiative' } },
    measure: { target: { kind: 'entity_schema', id: 'measure' } },
    business_capability: { target: { kind: 'entity_schema', id: 'business_capability' } },
    objective_supports_business_capability: { target: { kind: 'relation_schema', id: 'osc-rel' } },
    business_capability_supports_entity: { target: { kind: 'relation_schema', id: 'bcse-rel' } }
  }
};

const entity = (uid: string, name: string, extra: Record<string, unknown> = {}) => ({
  _uid: uid,
  _publicId: uid.toUpperCase(),
  _name: name,
  _schema: { id: 'x', name: 'X' },
  _owner: null,
  _lifecycle: null,
  ...extra
});

const relation = (uid: string, schemaId: string, inId: string, outId: string, outName: string) => ({
  _uid: uid,
  _schema: { id: schemaId, name: schemaId },
  _in: { id: inId, name: inId },
  _out: { id: outId, name: outName }
});

describe('StrategyStrategyScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyStrategyScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8 && container.textContent?.includes('Loading'); i++) {
      await flush();
    }
    await flush();
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.search = { objective: undefined };

    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });
    mocks.metricRollup.mockResolvedValue({ results: [] });

    mocks.entityList.mockImplementation(
      ({ query }: { query: { _schemaId?: string; conditions?: unknown } }) => {
        if (query._schemaId === 'objective') {
          return Promise.resolve({
            items: [
              entity('obj-1', 'Increase Checkout Conversion', {
                status: 'active',
                target_date: 'FY26'
              }),
              entity('obj-2', 'Reduce Delivery Time', { status: 'draft' })
            ],
            total: 2
          });
        }
        if (query._schemaId === 'business_capability') {
          return Promise.resolve({
            items: [entity('cap-1', 'Checkout Orchestration', { maturity: 3, maturity_target: 4 })],
            total: 1
          });
        }
        if (query._schemaId === 'outcome') {
          return Promise.resolve({
            items: [
              entity('out-1', 'Conversion +10%', { objectives: ['obj-1'] }),
              entity('out-2', 'Faster Delivery', { objectives: ['obj-2'] })
            ],
            total: 2
          });
        }
        if (query._schemaId === 'initiative') {
          return Promise.resolve({
            items: [
              entity('init-1', 'Checkout Flow Simplification', {
                status: 'active',
                objectives: ['obj-1']
              })
            ],
            total: 1
          });
        }
        if (query._schemaId === 'measure') {
          return Promise.resolve({
            items: [
              entity('m-1', 'Checkout conversion rate', {
                baseline: 40,
                current: 46,
                target_value: 50,
                unit: '%',
                outcomes: ['out-1']
              }),
              entity('m-flat', 'Flat measure', {
                baseline: 10,
                current: 10,
                target_value: 10,
                unit: '',
                outcomes: ['out-1']
              })
            ],
            total: 2
          });
        }
        return Promise.resolve({ items: [], total: 0 });
      }
    );

    mocks.relationList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'osc-rel') {
        return Promise.resolve({
          items: [relation('r1', 'osc-rel', 'obj-1', 'cap-1', 'Checkout Orchestration')],
          total: 1
        });
      }
      if (query.schemaId === 'bcse-rel') {
        return Promise.resolve({
          items: [relation('r2', 'bcse-rel', 'cap-1', 'app-1', 'Checkout Service')],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows the first objective in the header and its panels by default', async () => {
    await renderScreen();

    // Navigation is via the sidebar; the main view shows which objective is selected.
    expect(container.textContent).toContain('Increase Checkout Conversion');
    // First objective selected -> its outcome / initiative / measure / depends-on capability.
    expect(container.textContent).toContain('Conversion +10%');
    expect(container.textContent).toContain('Checkout Flow Simplification');
    expect(container.textContent).toContain('Checkout conversion rate');
    expect(container.textContent).toContain('Checkout Orchestration');
  });

  it('shows the objective named by the objective search param', async () => {
    mocks.search = { objective: 'obj-2' };
    await renderScreen();

    expect(container.textContent).toContain('Reduce Delivery Time');
  });

  it('renders a measure progress bar with clamped width and a 0 width for a zero span', async () => {
    await renderScreen();

    const fills = [...container.querySelectorAll('span')].filter(s => s.style.width?.endsWith('%'));
    const widths = fills.map(f => f.style.width);
    // (46-40)/(50-40) = 60%
    expect(widths).toContain('60%');
    // baseline === target -> 0%
    expect(widths).toContain('0%');
  });

  it('scopes the panels to the selected objective', async () => {
    mocks.search = { objective: 'obj-2' };
    await renderScreen();

    expect(container.textContent).toContain('Faster Delivery');
    expect(container.textContent).not.toContain('Conversion +10%');
    // obj-2 has no initiative or measure in the fixture.
    expect(container.textContent).toContain('No initiative pursues this objective.');
  });

  it('opens the capability drawer route from a depends-on table row', async () => {
    await renderScreen();

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Checkout Orchestration')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/strategy/$capabilityId',
        params: { workspaceSlug: 'ws-1', capabilityId: 'CAP-1' }
      })
    );
  });

  it('shows the not-enabled state when the capability is not configured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Strategy model is not enabled.');
  });
});
