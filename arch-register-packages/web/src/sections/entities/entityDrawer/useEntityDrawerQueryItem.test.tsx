// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEntityDrawerQueryItem,
  type EntityDrawerQueryItemResult
} from './useEntityDrawerQueryItem';

const mocks = vi.hoisted(() => ({ parseText: vi.fn(), entityList: vi.fn() }));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entityQueryText: { parseText: mocks.parseText },
    entities: { list: mocks.entityList }
  }
}));

const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });

let latest: EntityDrawerQueryItemResult | undefined;

const Harness = ({ queryText }: { queryText: string }) => {
  latest = useEntityDrawerQueryItem('ws-1', 'Business Capability', 'cap-1', queryText);
  return null;
};

describe('useEntityDrawerQueryItem', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    latest = undefined;
    mocks.parseText.mockReset();
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

  const render = (queryText: string) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness queryText={queryText} />
        </QueryClientProvider>
      );
    });
  };

  it('wraps the path expression with a root predicate, parses it, and resolves terminal entities', async () => {
    mocks.parseText.mockImplementation(async ({ query }: { query: { text: string } }) => {
      expect(query.text).toBe(
        'schema:"Business Capability" _id = "cap-1" columns path subtree(parent).->"Business Capability Supports Entity" as "value"'
      );
      return { ok: true, query: { root: { kind: 'predicate' }, projections: [] } };
    });
    mocks.entityList.mockImplementation(async ({ query }: { query: { entityQuery?: string } }) => {
      const entityQuery = query.entityQuery ? JSON.parse(query.entityQuery) : null;
      if (entityQuery?.root?.op === 'in') {
        // The follow-up id-set lookup.
        return { items: [{ _uid: 'app-1', _name: 'Billing System' }], total: 1 };
      }
      return {
        items: [
          {
            _uid: 'cap-1',
            _projections: {
              value: [[hop('child-1', 'business_capability'), hop('app-1', 'application')]]
            }
          }
        ],
        total: 1
      };
    });

    render('subtree(parent).->"Business Capability Supports Entity"');
    await flush();

    expect(latest?.items.map(item => item._uid)).toEqual(['app-1']);
    expect(latest?.error).toBeNull();
  });

  it('surfaces a parse error as the error result without executing the query', async () => {
    mocks.parseText.mockResolvedValue({
      ok: false,
      errors: [{ offset: 0, message: "Unknown field 'bogus'" }]
    });

    render('bogus(parent)');
    await flush();

    expect(mocks.entityList).not.toHaveBeenCalled();
    expect(latest?.items).toEqual([]);
    expect(latest?.error?.message).toContain("Unknown field 'bogus'");
  });
});
