// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskComplianceRetentionScreen } from './RiskComplianceRetentionScreen';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  relationsList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  params: { workspaceSlug: 'ws-1' } as { workspaceSlug: string },
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mocks.params,
  useSearch: () => mocks.search,
  useNavigate: () => mocks.navigate,
  Link: ({
    children,
    to,
    params,
    ...props
  }: Record<string, unknown> & { children?: unknown; params?: { entityId?: string } }) => (
    <a href={typeof to === 'string' ? to : undefined} data-entity-id={params?.entityId} {...props}>
      {children as never}
    </a>
  )
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'ws-1' })
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList },
    relations: { list: mocks.relationsList },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const CONFIG = {
  type: 'retention',
  valid: true,
  bindings: {
    policy: { target: { kind: 'entity_schema', id: 'policy-schema' } },
    assignment: { target: { kind: 'relation_schema', id: 'assignment-schema' } }
  }
};

const policy = (id: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _publicId: id,
  _name: `Policy ${id}`,
  duration: 3,
  time_unit: 'years',
  ...overrides
});

const assignment = (id: string, policyId: string, overrides: Record<string, unknown> = {}) => ({
  _uid: id,
  _schema: { id: 'assignment-schema', name: 'Subject to Retention Policy' },
  _in: { id: `entity-${id}`, name: `Entity ${id}`, schemaId: 'data-entity-schema' },
  _out: { id: policyId, name: `Policy ${policyId}`, schemaId: 'policy-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true,
  activated_from: '2026-01-01',
  ...overrides
});

describe('RiskComplianceRetentionScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderScreen = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RiskComplianceRetentionScreen />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.params = { workspaceSlug: 'ws-1' };
    mocks.search = {};
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.entityList.mockResolvedValue({ items: [policy('policy-1')], total: 1 });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1')],
      total: 1
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderScreen();
    expect(container.textContent).toContain('Retention is not configured');
  });

  it('renders the assignments register with the policy period and activation date as plain facts', async () => {
    await renderScreen();
    expect(container.textContent).toContain('Retention');
    expect(container.textContent).toContain('Entity assignment-1');
    expect(container.textContent).toContain('Policy policy-1');
    expect(container.textContent).toContain('3 years');
    // No expiry-dashboard/urgency framing left on the screen.
    expect(container.textContent).not.toContain('Overdue');
    expect(container.textContent).not.toContain('Expiry');
  });

  it('links the governed entity and policy cells to their entity records', async () => {
    await renderScreen();
    const links = [...container.querySelectorAll('a[data-entity-id]')];
    const entityIds = links.map(link => link.getAttribute('data-entity-id'));
    expect(entityIds).toContain('entity-assignment-1');
    expect(entityIds).toContain('policy-1');
  });

  it('shows what is missing for an incomplete assignment instead of a computed status', async () => {
    mocks.entityList.mockResolvedValue({
      items: [policy('policy-1', { duration: undefined })],
      total: 1
    });
    await renderScreen();
    expect(container.textContent).toContain('Missing duration');
  });

  it('filters the register by the policy search param', async () => {
    mocks.entityList.mockResolvedValue({
      items: [policy('policy-1'), policy('policy-2')],
      total: 2
    });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1'), assignment('assignment-2', 'policy-2')],
      total: 2
    });
    mocks.search = { policy: 'policy-1' };
    await renderScreen();
    expect(container.textContent).toContain('Entity assignment-1');
    expect(container.textContent).not.toContain('Entity assignment-2');
    // The active-filter chip names the policy.
    expect(container.textContent).toContain('Policy policy-1');
  });

  it('filters the register to incomplete assignments only', async () => {
    mocks.entityList.mockResolvedValue({
      items: [policy('policy-1'), policy('policy-2', { duration: undefined })],
      total: 2
    });
    mocks.relationsList.mockResolvedValue({
      items: [assignment('assignment-1', 'policy-1'), assignment('assignment-2', 'policy-2')],
      total: 2
    });
    mocks.search = { incomplete: '1' };
    await renderScreen();
    expect(container.textContent).toContain('Entity assignment-2');
    expect(container.textContent).not.toContain('Entity assignment-1');
  });
});
