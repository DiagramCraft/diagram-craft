// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyTraceabilityScreen } from './StrategyTraceabilityScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {
    tab: undefined as string | undefined,
    objective: undefined as string | undefined,
    capability: undefined as string | undefined
  },
  entityList: vi.fn(),
  entityTree: vi.fn(),
  relationList: vi.fn(),
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
    objective_supports_business_capability: {
      target: { kind: 'relation_schema', id: 'osc-rel' }
    },
    business_capability_supports_entity: {
      target: { kind: 'relation_schema', id: 'bcse-rel' }
    }
  }
};

const entity = (uid: string, name: string) => ({
  _uid: uid,
  _publicId: uid.toUpperCase(),
  _name: name,
  _schema: { id: 'x', name: 'X' },
  _owner: null,
  _lifecycle: null,
  capability_level: 'L1'
});

const relation = (uid: string, schemaId: string, inId: string, outId: string, outName: string) => ({
  _uid: uid,
  _schema: { id: schemaId, name: schemaId },
  _in: { id: inId, name: inId },
  _out: { id: outId, name: outName }
});

describe('StrategyTraceabilityScreen', () => {
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
          <StrategyTraceabilityScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 6 && container.textContent?.includes('Loading'); i++) {
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
    mocks.search = { tab: undefined, objective: undefined, capability: undefined };

    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });

    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'objective') {
        return Promise.resolve({
          items: [
            entity('obj-1', 'Increase Checkout Conversion'),
            entity('obj-2', 'Reduce Delivery Time')
          ],
          total: 2
        });
      }
      if (query._schemaId === 'business_capability') {
        return Promise.resolve({
          items: [
            entity('cap-1', 'Checkout Orchestration'),
            entity('cap-2', 'Last-Mile Delivery'),
            entity('cap-orphan', 'Unlinked Capability')
          ],
          total: 3
        });
      }
      if (query._schemaId === 'initiative') {
        return Promise.resolve({
          items: [entity('init-1', 'Checkout Flow Simplification')],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    mocks.relationList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'osc-rel') {
        return Promise.resolve({
          items: [
            relation('r1', 'osc-rel', 'obj-1', 'cap-1', 'Checkout Orchestration'),
            relation('r2', 'osc-rel', 'obj-2', 'cap-2', 'Last-Mile Delivery')
          ],
          total: 2
        });
      }
      if (query.schemaId === 'bcse-rel') {
        return Promise.resolve({
          items: [relation('r3', 'bcse-rel', 'cap-1', 'app-1', 'Checkout Service')],
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

  it('renders the three walker columns for the first objective by default', async () => {
    await renderScreen();

    expect(container.textContent).toContain('Objectives');
    expect(container.textContent).toContain('Increase Checkout Conversion');
    // First objective selected by default -> its capability and that capability's application.
    expect(container.textContent).toContain('Checkout Orchestration');
    expect(container.textContent).toContain('Checkout Service');
    expect(container.textContent).toContain('Checkout Flow Simplification');
  });

  it('lists capabilities with no objective link in the orphan tab', async () => {
    mocks.search = { tab: 'orphans', objective: undefined, capability: undefined };
    await renderScreen();

    const table = container.querySelector('table');
    expect(table).toBeDefined();
    expect(table!.textContent).toContain('Unlinked Capability');
    expect(table!.textContent).not.toContain('Checkout Orchestration');
  });

  it('switching to the orphan tab patches the tab search param', async () => {
    await renderScreen();

    const trigger = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('No strategy link')
    );
    expect(trigger).toBeDefined();
    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.any(Function)
      })
    );
    const call = mocks.navigate.mock.calls.find(([arg]) => typeof arg?.search === 'function');
    expect(call![0].search({})).toEqual(expect.objectContaining({ tab: 'orphans' }));
  });

  it('selecting an objective patches the objective search param', async () => {
    await renderScreen();

    const objectiveRow = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Reduce Delivery Time')
    );
    await act(async () => {
      objectiveRow!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/$workspaceSlug/strategy/traceability' })
    );
  });

  it('opens the capability drawer route from an orphan table row', async () => {
    mocks.search = { tab: 'orphans', objective: undefined, capability: undefined };
    await renderScreen();

    const row = [...container.querySelectorAll('tr')].find(tr =>
      tr.textContent?.includes('Unlinked Capability')
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/strategy/traceability/$capabilityId',
        params: { workspaceSlug: 'ws-1', capabilityId: 'CAP-ORPHAN' }
      })
    );
  });

  it('shows the not-enabled state when the capability is not configured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Strategy model is not enabled.');
  });
});
