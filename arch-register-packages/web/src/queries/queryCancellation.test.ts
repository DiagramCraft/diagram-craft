import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  entityBatchRelationsQuery,
  entityCountQuery,
  entityCountsBySchemaQuery,
  entityDependentsQuery,
  entityDetailQuery,
  entityFacetsQuery,
  entityJsonQuery,
  entityLandscapeDiffQuery,
  entityRelationsQuery,
  entityTimelineMarkersQuery,
  entityTreeQuery,
  entitiesBySchemaQuery,
  entitiesQuery,
  hydratedEntitiesBySchemaQuery
} from './entities';
import { documentSearchQuery, searchQuery } from './search';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  entities: {
    batchRelations: vi.fn(),
    count: vi.fn(),
    dependents: vi.fn(),
    diff: vi.fn(),
    facets: vi.fn(),
    get: vi.fn(),
    json: vi.fn(),
    list: vi.fn(),
    relations: vi.fn(),
    timelineMarkers: vi.fn(),
    tree: vi.fn()
  }
}));

vi.mock('../lib/orpcClient', () => ({
  orpcClient: {
    search: { query: mocks.search },
    entities: mocks.entities
  }
}));

type QueryOptionsWithFunction = {
  queryKey: readonly unknown[];
  queryFn?: (context: never) => unknown;
};

const invokeQuery = async (options: QueryOptionsWithFunction, signal: AbortSignal) => {
  if (!options.queryFn) throw new Error('Expected query function');

  return options.queryFn({
    client: new QueryClient(),
    direction: undefined,
    meta: undefined,
    pageParam: undefined,
    queryKey: options.queryKey,
    signal
  } as never);
};

describe('query cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.mockResolvedValue({
      entities: [],
      files: [],
      projects: [],
      relations: [],
      schemas: []
    });
    mocks.entities.batchRelations.mockResolvedValue({});
    mocks.entities.count.mockResolvedValue(0);
    mocks.entities.dependents.mockResolvedValue([]);
    mocks.entities.diff.mockResolvedValue({});
    mocks.entities.facets.mockResolvedValue({});
    mocks.entities.get.mockResolvedValue({});
    mocks.entities.json.mockResolvedValue({});
    mocks.entities.list.mockResolvedValue({ items: [], total: 0 });
    mocks.entities.relations.mockResolvedValue([]);
    mocks.entities.timelineMarkers.mockResolvedValue([]);
    mocks.entities.tree.mockResolvedValue([]);
  });

  it('forwards the query signal through search factories', async () => {
    const signal = new AbortController().signal;

    await invokeQuery(searchQuery('workspace', { q: 'query' }), signal);
    await invokeQuery(documentSearchQuery('workspace', 'query'), signal);

    expect(mocks.search).toHaveBeenNthCalledWith(1, expect.any(Object), { signal });
    expect(mocks.search).toHaveBeenNthCalledWith(2, expect.any(Object), { signal });
  });

  it('forwards the same signal through every entity query factory', async () => {
    const signal = new AbortController().signal;
    const queries = [
      [entityDetailQuery('workspace', 'entity'), mocks.entities.get],
      [entitiesQuery('workspace'), mocks.entities.list],
      [entityJsonQuery('workspace', 'entity'), mocks.entities.json],
      [
        entityLandscapeDiffQuery(
          'workspace',
          {
            asOf: '2026-01-01T00:00:00.000Z',
            includeOverdueChanges: false,
            includePlannedChanges: false
          },
          {
            asOf: '2026-02-01T00:00:00.000Z',
            includeOverdueChanges: false,
            includePlannedChanges: true
          }
        ),
        mocks.entities.diff
      ],
      [entityFacetsQuery('workspace'), mocks.entities.facets],
      [entityTimelineMarkersQuery('workspace'), mocks.entities.timelineMarkers],
      [entityCountQuery('workspace'), mocks.entities.count],
      [entityRelationsQuery('workspace', 'entity'), mocks.entities.relations],
      [entityDependentsQuery('workspace', 'entity', true), mocks.entities.dependents],
      [entityTreeQuery('workspace'), mocks.entities.tree],
      [entityBatchRelationsQuery('workspace', ['entity']), mocks.entities.batchRelations],
      [entitiesBySchemaQuery('workspace', 'schema'), mocks.entities.list],
      [hydratedEntitiesBySchemaQuery('workspace', 'schema'), mocks.entities.list],
      [entityCountsBySchemaQuery('workspace', 'schema'), mocks.entities.count]
    ] as const;

    for (const [query, request] of queries) {
      await invokeQuery(query, signal);
      expect(request).toHaveBeenLastCalledWith(expect.any(Object), { signal });
    }
  });

  it('does not expose cancellation as an error and can run the query again', async () => {
    const query = searchQuery('workspace', { q: 'query' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let requestCount = 0;

    mocks.search.mockImplementationOnce(
      (_input: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          requestCount += 1;
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('The request was aborted', 'AbortError')),
            { once: true }
          );
        })
    );

    const firstRequest = queryClient.fetchQuery(query).catch(() => undefined);
    await vi.waitFor(() => expect(mocks.search).toHaveBeenCalledOnce());

    await queryClient.cancelQueries({ queryKey: query.queryKey });
    await firstRequest;

    expect(requestCount).toBe(1);
    expect(mocks.search.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(queryClient.getQueryState(query.queryKey)?.status).not.toBe('error');

    mocks.search.mockResolvedValueOnce({
      entities: [],
      files: [],
      projects: [],
      relations: [],
      schemas: []
    });

    await expect(queryClient.fetchQuery(query)).resolves.toBeDefined();
    expect(mocks.search).toHaveBeenCalledTimes(2);
  });
});
