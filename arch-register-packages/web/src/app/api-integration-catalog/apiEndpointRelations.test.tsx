// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  groupByApiId,
  resolveTypedRelationSchemaId,
  useApiEndpointRelations
} from './apiEndpointRelations';

const mocks = vi.hoisted(() => ({ relationsList: vi.fn() }));

vi.mock('../../lib/orpcClient', () => ({
  orpcClient: { relations: { list: mocks.relationsList } }
}));

const API_SCHEMA: EntitySchema = {
  id: 'api',
  name: 'API',
  fields: [
    { id: 'providers', name: 'Provided by', type: 'typedRelation', relationSchemaId: 'provides-api' },
    { id: 'consumers', name: 'Consumed by', type: 'typedRelation', relationSchemaId: 'consumes-api' },
    { id: 'api_version', name: 'API Version', type: 'text' }
  ]
} as unknown as EntitySchema;

const relation = (id: string, apiId: string, endpointId: string): RelationRecord =>
  ({
    _uid: id,
    _schema: { id: 'provides-api', name: 'Provides API' },
    _in: { id: endpointId, name: `Endpoint ${endpointId}` },
    _out: { id: apiId, name: `API ${apiId}` }
  }) as unknown as RelationRecord;

describe('resolveTypedRelationSchemaId', () => {
  it('resolves a typedRelation field to its relation-schema id', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'providers')).toBe('provides-api');
  });

  it('returns null for a non-typedRelation field', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'api_version')).toBeNull();
  });

  it('returns null for a missing field or schema', () => {
    expect(resolveTypedRelationSchemaId(API_SCHEMA, 'nonexistent')).toBeNull();
    expect(resolveTypedRelationSchemaId(undefined, 'providers')).toBeNull();
  });
});

describe('groupByApiId', () => {
  it('groups relations by their API (_out) endpoint', () => {
    const relations = [relation('r1', 'api-1', 'e1'), relation('r2', 'api-1', 'e2'), relation('r3', 'api-2', 'e3')];
    const grouped = groupByApiId(relations);
    expect(grouped.get('api-1')).toHaveLength(2);
    expect(grouped.get('api-2')).toHaveLength(1);
    expect(grouped.get('api-3')).toBeUndefined();
  });

  it('returns an empty map for no relations', () => {
    expect(groupByApiId([]).size).toBe(0);
  });
});

describe('useApiEndpointRelations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let latest: ReturnType<typeof useApiEndpointRelations> | undefined;

  const Harness = ({ apiSchema }: { apiSchema: EntitySchema | undefined }) => {
    latest = useApiEndpointRelations('ws-1', apiSchema);
    return null;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.relationsList.mockReset();
    mocks.relationsList.mockImplementation(({ query }: { query: { schemaId?: string } }) => {
      if (query.schemaId === 'provides-api') {
        return Promise.resolve({ items: [relation('r1', 'api-1', 'e1')], total: 1 });
      }
      if (query.schemaId === 'consumes-api') {
        return Promise.resolve({ items: [relation('r2', 'api-1', 'e2')], total: 1 });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
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

  it('fetches providers and consumers relations once each and returns them', async () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness apiSchema={API_SCHEMA} />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.providers).toHaveLength(1);
    expect(latest?.consumers).toHaveLength(1);
    expect(mocks.relationsList).toHaveBeenCalledTimes(2);
  });

  it('returns empty arrays when the schema has no typed-relation fields', async () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness apiSchema={undefined} />
        </QueryClientProvider>
      );
    });
    await flush();

    expect(latest?.providers).toEqual([]);
    expect(latest?.consumers).toEqual([]);
    expect(mocks.relationsList).not.toHaveBeenCalled();
  });
});
