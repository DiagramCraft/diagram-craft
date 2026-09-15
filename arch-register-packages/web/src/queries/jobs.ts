import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { JobRunStatus } from '@arch-register/api-types/jobsContract';
import { orpcClient } from '../lib/orpcClient';

export type JobRunFilters = {
  scheduleId?: string;
  status?: JobRunStatus;
  plannedFrom?: string;
  plannedTo?: string;
  limit?: number;
  offset?: number;
};

export const jobKeys = {
  all: ['jobs'] as const,
  servers: (workspaceId: string) => [...jobKeys.all, 'servers', workspaceId] as const,
  schedules: (workspaceId: string) => [...jobKeys.all, 'schedules', workspaceId] as const,
  runsWorkspace: (workspaceId: string) => [...jobKeys.all, 'runs', workspaceId] as const,
  runs: (workspaceId: string, filters: JobRunFilters) =>
    [...jobKeys.runsWorkspace(workspaceId), filters] as const
};

type NormalizedJobRunFilters = Omit<JobRunFilters, 'limit' | 'offset'> & {
  limit: number;
  offset: number;
};

const normalizeJobRunFilters = (filters: JobRunFilters): NormalizedJobRunFilters => {
  const scheduleId = filters.scheduleId?.trim();
  const plannedFrom = filters.plannedFrom?.trim();
  const plannedTo = filters.plannedTo?.trim();

  return {
    scheduleId: scheduleId === '' ? undefined : scheduleId,
    status: filters.status,
    plannedFrom: plannedFrom === '' ? undefined : plannedFrom,
    plannedTo: plannedTo === '' ? undefined : plannedTo,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0
  };
};

export const jobServersQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: jobKeys.servers(workspaceId),
    queryFn: ({ signal }) =>
      orpcClient.jobs.servers.list({ params: { workspace: workspaceId } }, { signal }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const jobSchedulesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: jobKeys.schedules(workspaceId),
    queryFn: ({ signal }) =>
      orpcClient.jobs.schedules.list({ params: { workspace: workspaceId } }, { signal }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const jobRunsQuery = (workspaceId: string, filters: JobRunFilters, enabled = true) => {
  const normalizedFilters = normalizeJobRunFilters(filters);

  return queryOptions({
    queryKey: jobKeys.runs(workspaceId, normalizedFilters),
    queryFn: ({ signal }) =>
      orpcClient.jobs.runs.list(
        {
          params: { workspace: workspaceId },
          query: normalizedFilters
        },
        { signal }
      ),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });
};

export const invalidateJobServerQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: jobKeys.servers(workspaceId) });

export const invalidateJobScheduleQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: jobKeys.schedules(workspaceId) });

export const invalidateJobRunQueries = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: jobKeys.runsWorkspace(workspaceId) });

export const invalidateJobQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    invalidateJobServerQueries(queryClient, workspaceId),
    invalidateJobScheduleQueries(queryClient, workspaceId),
    invalidateJobRunQueries(queryClient, workspaceId)
  ]);
};
