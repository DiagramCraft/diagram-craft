// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssetCoverageRollups, type AssetCoverageRollups } from './useAssetCoverageRollups';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.list } }
}));

const relation = (schemaId: string, inId: string, outId: string, outName: string) => ({
  _uid: `rel-${schemaId}-${inId}-${outId}`,
  _schema: { id: schemaId, name: schemaId },
  _in: { id: inId, name: `In ${inId}`, schemaId: 'in-schema' },
  _out: { id: outId, name: outName, schemaId: 'entity-schema' },
  _owner: null,
  _lifecycle: null,
  _version: 1,
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  canView: true,
  canEdit: true
});

let latest: AssetCoverageRollups | undefined;

const Harness = ({
  riskAffectsRelationSchemaId,
  controlAffectsRelationSchemaId
}: {
  riskAffectsRelationSchemaId: string | null;
  controlAffectsRelationSchemaId: string | null;
}) => {
  latest = useAssetCoverageRollups(
    'ws-1',
    riskAffectsRelationSchemaId,
    controlAffectsRelationSchemaId
  );
  return null;
};

describe('useAssetCoverageRollups', () => {
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

  const render = (a: string | null, b: string | null) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness riskAffectsRelationSchemaId={a} controlAffectsRelationSchemaId={b} />
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
    expect(latest).toEqual({ items: [], isLoading: false, error: null });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('counts distinct risks affecting and controls protecting each asset', async () => {
    mocks.list.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'risk-affects-schema') {
        return Promise.resolve({
          items: [
            relation('risk-affects-schema', 'risk-1', 'asset-1', 'Customer DB'),
            relation('risk-affects-schema', 'risk-2', 'asset-1', 'Customer DB')
          ],
          total: 2
        });
      }
      if (query.schemaId === 'control-affects-schema') {
        return Promise.resolve({
          items: [relation('control-affects-schema', 'control-1', 'asset-1', 'Customer DB')],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    render('risk-affects-schema', 'control-affects-schema');
    await flush();

    expect(latest?.items).toEqual([
      {
        assetId: 'asset-1',
        assetName: 'Customer DB',
        assetSchemaId: 'entity-schema',
        riskCount: 2,
        controlCount: 1
      }
    ]);
  });

  it('surfaces an asset that has risks but no protecting control', async () => {
    mocks.list.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'risk-affects-schema') {
        return Promise.resolve({
          items: [relation('risk-affects-schema', 'risk-1', 'asset-2', 'Marketing List')],
          total: 1
        });
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    render('risk-affects-schema', 'control-affects-schema');
    await flush();

    expect(latest?.items).toEqual([
      {
        assetId: 'asset-2',
        assetName: 'Marketing List',
        assetSchemaId: 'entity-schema',
        riskCount: 1,
        controlCount: 0
      }
    ]);
  });

  it('falls back to null when no relation endpoint carries a schema id', async () => {
    mocks.list.mockImplementation(({ query }: { query: { schemaId?: string } }) =>
      query.schemaId === 'risk-affects-schema'
        ? Promise.resolve({
            items: [
              {
                ...relation('risk-affects-schema', 'risk-1', 'asset-3', 'Deleted Asset'),
                _out: { id: 'asset-3', name: 'Deleted Asset' }
              }
            ],
            total: 1
          })
        : Promise.resolve({ items: [], total: 0 })
    );

    render('risk-affects-schema', 'control-affects-schema');
    await flush();

    expect(latest?.items).toEqual([
      {
        assetId: 'asset-3',
        assetName: 'Deleted Asset',
        assetSchemaId: null,
        riskCount: 1,
        controlCount: 0
      }
    ]);
  });
});
