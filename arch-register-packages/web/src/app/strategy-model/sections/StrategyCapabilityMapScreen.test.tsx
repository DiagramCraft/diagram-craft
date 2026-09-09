// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyCapabilityMapScreen } from './StrategyCapabilityMapScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { focus: undefined as string | undefined, owner: undefined as string | undefined },
  params: { workspaceSlug: 'ws-1', capabilityId: undefined as string | undefined },
  entityList: vi.fn(),
  entityTree: vi.fn(),
  metricsRollup: vi.fn(),
  capabilityConfigurationsList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, tree: mocks.entityTree, get: vi.fn() },
    relations: { listForEntity: vi.fn() },
    metrics: { rollup: mocks.metricsRollup },
    config: {
      teams: { list: vi.fn().mockResolvedValue([]) },
      lifecycleStates: { list: vi.fn().mockResolvedValue([]) },
      capabilityConfigurations: { list: mocks.capabilityConfigurationsList }
    }
  }
}));

const capability = (uid: string, name: string, level: string, over: Record<string, unknown> = {}) => ({
  _uid: uid,
  _publicId: uid.toUpperCase(),
  _name: name,
  _schema: { id: 'business_capability', name: 'Business Capability' },
  _owner: null,
  _lifecycle: null,
  capability_level: level,
  maturity: 3,
  ...over
});

describe('StrategyCapabilityMapScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const render = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <StrategyCapabilityMapScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 6 && container.textContent?.includes('Loading'); i++) await flush();
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
    mocks.search = { focus: undefined, owner: undefined };
    mocks.params = { workspaceSlug: 'ws-1', capabilityId: undefined };

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
            target: { kind: 'relation_schema', id: 'osc-rel' }
          },
          business_capability_supports_entity: {
            target: { kind: 'relation_schema', id: 'bcs-rel' }
          }
        }
      }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        capability('d-cs', 'Customer Service', 'L1'),
        capability('c-care', 'Customer Care', 'L2'),
        capability('c-contact', 'Contact Center', 'L3'),
        capability('c-selfsvc', 'Self Service', 'L3'),
        capability('d-fin', 'Finance', 'L1')
      ],
      total: 5
    });
    mocks.entityTree.mockResolvedValue({
      nodes: [
        { _uid: 'd-cs', _name: 'Customer Service' },
        { _uid: 'c-care', _name: 'Customer Care' },
        { _uid: 'c-contact', _name: 'Contact Center' },
        { _uid: 'c-selfsvc', _name: 'Self Service' },
        { _uid: 'd-fin', _name: 'Finance' }
      ],
      edges: [
        { parentId: 'd-cs', childId: 'c-care' },
        { parentId: 'c-care', childId: 'c-contact' },
        { parentId: 'c-care', childId: 'c-selfsvc' }
      ]
    });
    mocks.metricsRollup.mockImplementation(
      ({ body }: { body: { boxEntityIds: string[]; metric: { source: { fieldId?: string } } } }) => {
        const fieldId = body.metric?.source?.fieldId;
        const value = fieldId === 'maturity' ? 4 : fieldId === 'risk' ? 2 : 1;
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

  it('renders the L1/L2/L3 grid', async () => {
    await render();
    expect(container.textContent).toContain('Customer Service');
    expect(container.textContent).toContain('Customer Care');
    expect(container.textContent).toContain('Contact Center');
    expect(container.textContent).toContain('Finance');
    expect(mocks.entityList).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ view: 'full' }) })
    );
  });

  it('shows overlay values when an overlay is selected', async () => {
    await render();
    const select = [...container.querySelectorAll('select')].find(s =>
      [...s.options].some(o => o.value === 'maturity')
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = 'maturity';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    const leaf = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Contact Center')
    );
    expect(leaf?.textContent).toContain('4.0');
  });

  it('dims tiles that do not match the search box', async () => {
    await render();
    const input = container.querySelector('input') as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    await act(async () => {
      nativeSetter.call(input, 'contact');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
    const leafClass = (name: string) =>
      [...container.querySelectorAll('button')].find(b => b.textContent?.includes(name))?.className ??
      '';
    expect(leafClass('Contact Center')).not.toMatch(/leafDim/);
    expect(leafClass('Self Service')).toMatch(/leafDim/);
  });

  it('collapses to one domain and shows "All domains" when focused', async () => {
    mocks.search = { focus: 'd-cs', owner: undefined };
    await render();
    expect(container.textContent).toContain('Customer Service');
    expect(container.textContent).not.toContain('Finance');
    expect(container.textContent).toContain('All domains');
  });

  it('opens the drawer route when a leaf tile is clicked', async () => {
    await render();
    const leaf = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Contact Center')
    );
    await act(async () => {
      leaf!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/map/$capabilityId',
        params: { workspaceSlug: 'ws-1', capabilityId: 'C-CONTACT' }
      })
    );
  });
});
