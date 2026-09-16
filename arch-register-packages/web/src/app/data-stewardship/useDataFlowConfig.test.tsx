// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataFlowConfig } from './useDataFlowConfig';

const mocks = vi.hoisted(() => ({
  relationSchemasList: vi.fn()
}));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: {
    relationSchemas: { list: mocks.relationSchemasList }
  }
}));

describe('useDataFlowConfig', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let result: { data: { relationSchemaId: string } | null; isLoading: boolean } | undefined;

  const Probe = ({ workspaceSlug }: { workspaceSlug: string }) => {
    result = useDataFlowConfig(workspaceSlug);
    return null;
  };

  const wrapper = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderHook = async () => {
    await act(async () => {
      root.render(wrapper(<Probe workspaceSlug="ws-1" />));
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
    result = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('resolves the Data Flow relation schema by name when present', async () => {
    mocks.relationSchemasList.mockResolvedValue([
      { id: 'rs-1', name: 'Data Flow' },
      { id: 'rs-2', name: 'Something Else' }
    ]);
    await renderHook();
    expect(result).toEqual({ data: { relationSchemaId: 'rs-1' }, isLoading: false });
  });

  it('returns null when no relation schema is named "Data Flow"', async () => {
    mocks.relationSchemasList.mockResolvedValue([{ id: 'rs-2', name: 'Something Else' }]);
    await renderHook();
    expect(result).toEqual({ data: null, isLoading: false });
  });
});
