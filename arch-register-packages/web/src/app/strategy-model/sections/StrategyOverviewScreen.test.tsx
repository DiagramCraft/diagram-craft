// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategyOverviewScreen } from './StrategyOverviewScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  entityTree: vi.fn(),
  relationList: vi.fn(),
  metricRollup: vi.fn(),
  capabilityConfigurationsList: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ workspaceSlug: 'ws-1' }),
  useNavigate: () => mocks.navigate
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList, get: vi.fn(), tree: mocks.entityTree },
    relations: { list: mocks.relationList, listForEntity: vi.fn() },
    metrics: { rollup: mocks.metricRollup },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
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

const relation = (uid: string, schemaId: string, inId: string, outId: string) => ({
  _uid: uid,
  _schema: { id: schemaId, name: schemaId },
  _in: { id: inId, name: inId },
  _out: { id: outId, name: outId }
});

describe('StrategyOverviewScreen', () => {
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
          <StrategyOverviewScreen />
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

    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.entityTree.mockResolvedValue({ nodes: [], edges: [] });
    mocks.metricRollup.mockResolvedValue({ results: [], legend: { min: null, max: null } });

    mocks.entityList.mockImplementation(({ query }: { query: { _schemaId?: string } }) => {
      if (query._schemaId === 'business_capability') {
        return Promise.resolve({
          items: [
            entity('cap-1', 'Checkout Orchestration', { capability_level: 'L1' }),
            entity('cap-2', 'Last-Mile Delivery', { capability_level: 'L2' }),
            entity('cap-orphan', 'Unlinked Capability', { capability_level: 'L2' })
          ],
          total: 3
        });
      }
      if (query._schemaId === 'objective') {
        return Promise.resolve({
          items: [
            entity('obj-1', 'Increase Conversion', { status: 'active' }),
            entity('obj-2', 'Reduce Delivery Time', { status: 'draft' })
          ],
          total: 2
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    mocks.relationList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'osc-rel') {
        return Promise.resolve({
          items: [
            relation('r1', 'osc-rel', 'obj-1', 'cap-1'),
            relation('r2', 'osc-rel', 'obj-2', 'cap-2')
          ],
          total: 2
        });
      }
      if (query.schemaId === 'bcse-rel') {
        return Promise.resolve({ items: [relation('r3', 'bcse-rel', 'cap-1', 'app-1')], total: 1 });
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

  it('renders summary tiles with computed values', async () => {
    await renderScreen();

    expect(container.textContent).toContain('Capabilities');
    expect(container.textContent).toContain('Objectives');
    // Coverage: 1 of 3 capabilities has an application.
    expect(container.textContent).toContain('33.3%');
    expect(container.textContent).toContain('1 of 3 capabilities have ≥1 application');
    // Orphans: cap-orphan is supported by no objective.
    expect(container.textContent).toContain('Orphan capabilities');
    const orphanTile = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Orphan capabilities')
    );
    expect(orphanTile!.textContent).toContain('1');
  });

  it('navigates to the traceability orphan tab from the orphan tile', async () => {
    await renderScreen();

    const orphanTile = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Orphan capabilities')
    );
    await act(async () => {
      orphanTile!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const call = mocks.navigate.mock.calls.find(
      ([arg]) => arg?.to === '/$workspaceSlug/strategy/traceability'
    );
    expect(call).toBeDefined();
    expect(call![0].search()).toEqual({ tab: 'orphans' });
  });

  it('navigates to the capabilities list filtered by level from a level legend entry', async () => {
    await renderScreen();

    const levelButton = [...container.querySelectorAll('button')].find(b =>
      b.textContent?.trim().startsWith('L1')
    );
    expect(levelButton).toBeDefined();
    await act(async () => {
      levelButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const call = mocks.navigate.mock.calls.find(
      ([arg]) => arg?.to === '/$workspaceSlug/strategy/capabilities'
    );
    expect(call).toBeDefined();
    expect(call![0].search()).toEqual({ level: 'L1' });
  });

  it('shows the not-enabled state when the capability is not configured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Strategy model is not enabled.');
  });
});
