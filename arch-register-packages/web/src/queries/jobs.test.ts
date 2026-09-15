import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobRunsQuery, jobSchedulesQuery, jobServersQuery } from './jobs';

const mocks = vi.hoisted(() => ({
  jobs: {
    servers: { list: vi.fn() },
    schedules: { list: vi.fn() },
    runs: { list: vi.fn() }
  }
}));

vi.mock('../lib/orpcClient', () => ({
  orpcClient: { jobs: mocks.jobs }
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

describe('job queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jobs.servers.list.mockResolvedValue([]);
    mocks.jobs.schedules.list.mockResolvedValue([]);
    mocks.jobs.runs.list.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  });

  it('forwards query cancellation signals to every job list request', async () => {
    const signal = new AbortController().signal;

    await invokeQuery(jobServersQuery('ws-1'), signal);
    await invokeQuery(jobSchedulesQuery('ws-1'), signal);
    await invokeQuery(jobRunsQuery('ws-1', {}), signal);

    expect(mocks.jobs.servers.list).toHaveBeenCalledWith(
      { params: { workspace: 'ws-1' } },
      { signal }
    );
    expect(mocks.jobs.schedules.list).toHaveBeenCalledWith(
      { params: { workspace: 'ws-1' } },
      { signal }
    );
    expect(mocks.jobs.runs.list).toHaveBeenCalledWith(
      {
        params: { workspace: 'ws-1' },
        query: { limit: 50, offset: 0 }
      },
      { signal }
    );
  });

  it('uses one cache key for equivalent defaulted run filters', async () => {
    const defaults = jobRunsQuery('ws-1', {});
    const explicitDefaults = jobRunsQuery('ws-1', { limit: 50, offset: 0 });

    expect(defaults.queryKey).toEqual(explicitDefaults.queryKey);

    await invokeQuery(
      jobRunsQuery('ws-1', {
        scheduleId: '  ',
        plannedFrom: ' ',
        plannedTo: '',
        status: 'running'
      }),
      new AbortController().signal
    );

    expect(mocks.jobs.runs.list).toHaveBeenLastCalledWith(
      {
        params: { workspace: 'ws-1' },
        query: { status: 'running', limit: 50, offset: 0 }
      },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('allows callers to disable inactive run-history polling', () => {
    expect(jobRunsQuery('ws-1', {}, false).enabled).toBe(false);
  });
});
