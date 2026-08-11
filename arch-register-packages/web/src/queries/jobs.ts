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
  runs: (workspaceId: string, filters: Record<string, unknown>) =>
    [...jobKeys.runsWorkspace(workspaceId), filters] as const
};

export const jobServersQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: jobKeys.servers(workspaceId),
    queryFn: () => orpcClient.jobs.servers.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const jobSchedulesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: jobKeys.schedules(workspaceId),
    queryFn: () => orpcClient.jobs.schedules.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const jobRunsQuery = (workspaceId: string, filters: JobRunFilters, enabled = true) =>
  queryOptions({
    queryKey: jobKeys.runs(workspaceId, filters),
    queryFn: () =>
      orpcClient.jobs.runs.list({
        params: { workspace: workspaceId },
        query: {
          scheduleId: filters.scheduleId,
          status: filters.status,
          plannedFrom: filters.plannedFrom,
          plannedTo: filters.plannedTo,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0
        }
      }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5000
  });

export const invalidateJobQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: jobKeys.servers(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: jobKeys.schedules(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: jobKeys.runsWorkspace(workspaceId) })
  ]);
};
