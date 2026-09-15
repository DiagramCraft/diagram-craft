// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useControlTraceMatrix, type ControlTraceMatrix } from './useControlTraceMatrix';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.list } }
}));

const riskControlRelation = (controlId: string, riskId: string) => ({
  _uid: `rc-${controlId}-${riskId}`,
  _schema: { id: 'risk-control-schema', name: 'Risk Mitigation' },
  _in: { id: riskId, name: `Risk ${riskId}`, schemaId: 'risk-schema' },
  _out: { id: controlId, name: `Control ${controlId}`, schemaId: 'control-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true,
  effectiveness: 'full',
  coverage: 100
});

const controlAffectsRelation = (controlId: string, assetId: string) => ({
  _uid: `ca-${controlId}-${assetId}`,
  _schema: { id: 'control-affects-schema', name: 'Control Protection' },
  _in: { id: controlId, name: `Control ${controlId}`, schemaId: 'control-schema' },
  _out: { id: assetId, name: `Asset ${assetId}`, schemaId: 'data-entity-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true
});

let latest: ControlTraceMatrix | undefined;

const Harness = ({
  riskControlSchemaId,
  controlAffectsSchemaId
}: {
  riskControlSchemaId: string | null;
  controlAffectsSchemaId: string | null;
}) => {
  latest = useControlTraceMatrix('ws-1', riskControlSchemaId, controlAffectsSchemaId);
  return null;
};

describe('useControlTraceMatrix', () => {
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

  const render = (riskControlSchemaId: string | null, controlAffectsSchemaId: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness
            riskControlSchemaId={riskControlSchemaId}
            controlAffectsSchemaId={controlAffectsSchemaId}
          />
        </QueryClientProvider>
      );
    });
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('returns empty result when disabled (no relation schema ids)', () => {
    render(null, null);
    expect(latest).toEqual({
      riskIdsByControlId: new Map(),
      assetIdsByControlId: new Map(),
      controlIdsByRiskId: new Map(),
      controlIdsByAssetId: new Map(),
      isLoading: false,
      error: null
    });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('builds control<->risk and control<->asset membership in both directions', async () => {
    mocks.list.mockImplementation(({ query }: { query?: { schemaId?: string } }) => {
      const schemaId = query?.schemaId;
      if (schemaId === 'risk-control-schema') {
        return Promise.resolve({
          items: [
            riskControlRelation('control-1', 'risk-1'),
            riskControlRelation('control-1', 'risk-2'),
            riskControlRelation('control-2', 'risk-1')
          ],
          total: 3
        });
      }
      if (schemaId === 'control-affects-schema') {
        return Promise.resolve({
          items: [controlAffectsRelation('control-1', 'asset-1')],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render('risk-control-schema', 'control-affects-schema');
    await flush();

    expect(latest?.riskIdsByControlId.get('control-1')).toEqual(new Set(['risk-1', 'risk-2']));
    expect(latest?.riskIdsByControlId.get('control-2')).toEqual(new Set(['risk-1']));
    expect(latest?.controlIdsByRiskId.get('risk-1')).toEqual(new Set(['control-1', 'control-2']));
    expect(latest?.controlIdsByRiskId.get('risk-2')).toEqual(new Set(['control-1']));
    expect(latest?.assetIdsByControlId.get('control-1')).toEqual(new Set(['asset-1']));
    expect(latest?.controlIdsByAssetId.get('asset-1')).toEqual(new Set(['control-1']));
    expect(latest?.controlIdsByAssetId.has('asset-2')).toBe(false);
  });

  it('surfaces a query error', async () => {
    mocks.list.mockRejectedValue(new Error('boom'));
    render('risk-control-schema', null);
    await flush();

    expect(latest?.error?.message).toBe('boom');
  });
});
