// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  useVendorTechnologyExposure,
  type VendorTechnologyExposure
} from './useVendorTechnologyExposure';

const mocks = vi.hoisted(() => ({ entityList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { entities: { list: mocks.entityList } }
}));

const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });

const componentSchema: EntitySchema = {
  id: 'component',
  name: 'Component',
  fields: [
    { id: 'system', type: 'containment', schemaId: 'system', minCount: 1, maxCount: 1 },
    {
      id: 'technology_releases',
      type: 'reference',
      schemaId: 'technology_release',
      minCount: 0,
      maxCount: -1
    }
  ]
} as unknown as EntitySchema;

const unrelatedSchema: EntitySchema = {
  id: 'api',
  name: 'API',
  fields: [{ id: 'system', type: 'containment', schemaId: 'system', minCount: 1, maxCount: 1 }]
} as unknown as EntitySchema;

let latest: VendorTechnologyExposure | undefined;

const Harness = ({ schemas }: { schemas: EntitySchema[] }) => {
  latest = useVendorTechnologyExposure(
    'ws-1',
    'vendor',
    ['vnd-1'],
    'contract',
    'system-contract-rel',
    'technology_release',
    schemas
  );
  return null;
};

describe('useVendorTechnologyExposure', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.entityList.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => await new Promise(resolve => setTimeout(resolve, 0)));
    }
  };

  it('resolves vendor -> contract -> system -> technology release rows with exposure banding', async () => {
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.projections?.[0]?.alias === 'systems') {
        return {
          items: [
            {
              _uid: 'vnd-1',
              _name: 'Vendor 1',
              _publicId: 'VND-1',
              _projections: { systems: [[hop('con-1', 'contract'), hop('sys-1', 'system')]] }
            }
          ],
          total: 1
        };
      }
      if (entityQuery?.projections?.[0]?.alias === 'tech0') {
        // System -> Technology Release projection.
        return {
          items: [
            {
              _uid: 'sys-1',
              _projections: {
                tech0: [[hop('cmp-1', 'component'), hop('tr-1', 'technology_release')]]
              }
            }
          ],
          total: 1
        };
      }
      // The follow-up id-set lookup (no projections, root op 'in').
      return {
        items: [
          { _uid: 'con-1', _name: 'Contract 1', _publicId: 'CON-1' },
          { _uid: 'sys-1', _name: 'System 1', _publicId: 'SYS-1' },
          {
            _uid: 'tr-1',
            _name: 'Node 18',
            _publicId: 'TR-1',
            eol_date: '2020-01-01T00:00:00.000Z',
            security_support_until: null
          }
        ],
        total: 3
      };
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness schemas={[componentSchema, unrelatedSchema]} />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.unavailable).toBe(false);
    expect(latest?.items).toHaveLength(1);
    const row = latest!.items[0]!;
    expect(row.vendor._uid).toBe('vnd-1');
    expect(row.contract._uid).toBe('con-1');
    expect(row.system._uid).toBe('sys-1');
    expect(row.technologyRelease._uid).toBe('tr-1');
    expect(row.exposure.band).toBe('past');
  });

  it('reports unavailable when no schema links System to the bound Technology Release schema', async () => {
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.projections?.[0]?.alias === 'systems') {
        return {
          items: [
            {
              _uid: 'vnd-1',
              _projections: { systems: [[hop('con-1', 'contract'), hop('sys-1', 'system')]] }
            }
          ],
          total: 1
        };
      }
      return { items: [{ _uid: 'con-1' }, { _uid: 'sys-1' }], total: 2 };
    });

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness schemas={[unrelatedSchema]} />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.unavailable).toBe(true);
    expect(latest?.items).toHaveLength(0);
  });
});
