// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRiskCoverageRollup, type RiskCoverageRollup } from './useRiskCoverageRollup';

const mocks = vi.hoisted(() => ({ listForEntity: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { listForEntity: mocks.listForEntity } }
}));

const relation = (overrides: Record<string, unknown> = {}) => ({
  _uid: 'rel-1',
  _schema: { id: 'risk-control-schema', name: 'Risk Mitigation' },
  _in: { id: 'risk-1', name: 'Customer Account Takeover', schemaId: 'risk-schema' },
  _out: { id: 'control-1', name: 'MFA Enforcement', schemaId: 'control-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true,
  effectiveness: 'partial',
  coverage: 70,
  ...overrides
});

let latest: RiskCoverageRollup | undefined;

const Harness = ({
  riskId,
  relationSchemaId
}: {
  riskId: string | null;
  relationSchemaId: string | null;
}) => {
  latest = useRiskCoverageRollup('ws-1', riskId, relationSchemaId);
  return null;
};

describe('useRiskCoverageRollup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.listForEntity.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (riskId: string | null, relationSchemaId: string | null = 'risk-control-schema') => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness riskId={riskId} relationSchemaId={relationSchemaId} />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no riskId or relation schema id)', () => {
    render(null);
    expect(latest).toEqual({
      rcCoverage: null,
      rcBand: null,
      controls: [],
      isLoading: false,
      error: null
    });
    expect(mocks.listForEntity).not.toHaveBeenCalled();

  });

  it('returns no controls/coverage when riskId is set but the relation schema id is not yet resolved', async () => {
    mocks.listForEntity.mockResolvedValue({ outgoing: [relation()], incoming: [] });
    render('risk-1', null);
    await flush();
    expect(latest?.controls).toEqual([]);
    expect(latest?.rcCoverage).toBeNull();
  });

  it('resolves rcCoverage and the mitigating Controls list from the risk-control relations', async () => {
    mocks.listForEntity.mockResolvedValue({
      outgoing: [relation()],
      incoming: []
    });
    render('risk-1');
    await flush();

    expect(latest?.rcCoverage).toBe(35); // 70 * 0.5 (partial)
    expect(latest?.rcBand).toBe('partial');
    expect(latest?.controls).toEqual([
      { relation: expect.any(Object), controlId: 'control-1', controlName: 'MFA Enforcement' }
    ]);
  });

  it('ignores relations of a different schema, and relations where this risk is not the "_in" endpoint', async () => {
    mocks.listForEntity.mockResolvedValue({
      outgoing: [
        relation({ _schema: { id: 'other-schema', name: 'Other' } }),
        relation({ _in: { id: 'other-risk', name: 'Other Risk', schemaId: 'risk-schema' } })
      ],
      incoming: []
    });
    render('risk-1');
    await flush();

    expect(latest?.controls).toEqual([]);
    expect(latest?.rcCoverage).toBeNull();
  });

  it('reads risk-control relations regardless of which bucket (outgoing/incoming) the API groups them into', async () => {
    mocks.listForEntity.mockResolvedValue({
      outgoing: [],
      incoming: [relation({ coverage: 100, effectiveness: 'full' })]
    });
    render('risk-1');
    await flush();

    expect(latest?.rcCoverage).toBe(100);
    expect(latest?.rcBand).toBe('strong');
  });

  it('surfaces a query error', async () => {
    mocks.listForEntity.mockRejectedValue(new Error('boom'));
    render('risk-1');
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
