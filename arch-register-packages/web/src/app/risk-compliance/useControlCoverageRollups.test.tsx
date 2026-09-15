// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useControlCoverageRollups,
  type ControlCoverageRollups
} from './useControlCoverageRollups';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.list } }
}));

const relation = (controlId: string, overrides: Record<string, unknown> = {}) => ({
  _uid: `rel-${controlId}-${Math.random()}`,
  _schema: { id: 'risk-control-schema', name: 'Risk Mitigation' },
  _in: { id: 'risk-1', name: 'Risk 1', schemaId: 'risk-schema' },
  _out: { id: controlId, name: `Control ${controlId}`, schemaId: 'control-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true,
  effectiveness: 'full',
  coverage: 100,
  ...overrides
});

let latest: ControlCoverageRollups | undefined;

const Harness = ({ relationSchemaId }: { relationSchemaId: string | null }) => {
  latest = useControlCoverageRollups('ws-1', relationSchemaId);
  return null;
};

describe('useControlCoverageRollups', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.list.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (relationSchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness relationSchemaId={relationSchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no relation schema id)', () => {
    render(null);
    expect(latest).toEqual({
      byId: new Map(),
      riskCountById: new Map(),
      isLoading: false,
      error: null
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('groups relations by mitigating Control id and computes per-Control coverage', async () => {
    mocks.list.mockResolvedValue({
      items: [
        relation('control-1', { coverage: 100, effectiveness: 'full' }),
        relation('control-2', { coverage: 70, effectiveness: 'partial' })
      ],
      total: 2
    });
    render('risk-control-schema');
    await flush();

    expect(latest?.byId.get('control-1')).toEqual({ rcCoverage: 100, rcBand: 'strong' });
    expect(latest?.riskCountById.get('control-1')).toBe(1);
    expect(latest?.byId.get('control-2')).toEqual({ rcCoverage: 35, rcBand: 'partial' });
    expect(latest?.byId.has('control-3')).toBe(false);
  });

  it('counts multiple risk-control relations for the same Control', async () => {
    mocks.list.mockResolvedValue({
      items: [relation('control-1'), relation('control-1')],
      total: 2
    });
    render('risk-control-schema');
    await flush();

    expect(latest?.riskCountById.get('control-1')).toBe(2);
  });
});
