// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRiskCoverageRollups, type RiskCoverageRollups } from './useRiskCoverageRollups';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.list } }
}));

const relation = (riskId: string, overrides: Record<string, unknown> = {}) => ({
  _uid: `rel-${riskId}-${Math.random()}`,
  _schema: { id: 'risk-control-schema', name: 'Risk Mitigation' },
  _in: { id: riskId, name: `Risk ${riskId}`, schemaId: 'risk-schema' },
  _out: { id: 'control-1', name: 'MFA Enforcement', schemaId: 'control-schema' },
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

let latest: RiskCoverageRollups | undefined;

const Harness = ({ relationSchemaId }: { relationSchemaId: string | null }) => {
  latest = useRiskCoverageRollups('ws-1', relationSchemaId);
  return null;
};

describe('useRiskCoverageRollups', () => {
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
    expect(latest).toEqual({ byId: new Map(), isLoading: false, error: null });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('groups relations by mitigated Risk id and computes per-Risk coverage', async () => {
    mocks.list.mockResolvedValue({
      items: [
        relation('risk-1', { coverage: 100, effectiveness: 'full' }),
        relation('risk-2', { coverage: 70, effectiveness: 'partial' })
      ],
      total: 2
    });
    render('risk-control-schema');
    await flush();

    expect(latest?.byId.get('risk-1')).toEqual({ rcCoverage: 100, rcBand: 'strong' });
    expect(latest?.byId.get('risk-2')).toEqual({ rcCoverage: 35, rcBand: 'partial' });
    expect(latest?.byId.has('risk-3')).toBe(false);

    const [request] = mocks.list.mock.calls[0]!;
    expect(request.query.schemaId).toBe('risk-control-schema');
  });

  it('combines multiple controls for the same Risk into one roll-up', async () => {
    mocks.list.mockResolvedValue({
      items: [
        relation('risk-1', { coverage: 100, effectiveness: 'partial' }),
        relation('risk-1', { coverage: 100, effectiveness: 'partial' })
      ],
      total: 2
    });
    render('risk-control-schema');
    await flush();

    // 1 - 0.5*0.5 = 0.75
    expect(latest?.byId.get('risk-1')).toEqual({ rcCoverage: 75, rcBand: 'strong' });
  });

  it('surfaces a query error', async () => {
    mocks.list.mockRejectedValue(new Error('boom'));
    render('risk-control-schema');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
