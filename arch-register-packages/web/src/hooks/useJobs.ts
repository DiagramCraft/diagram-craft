import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateJobBody, JobRunStatus } from '@arch-register/api-types/jobsContract';
import { orpcClient } from '../lib/orpcClient';
import { invalidateJobQueries, jobKeys } from '../queries/jobs';

export type JobRunFilters = {
  scheduleId?: string;
  status?: JobRunStatus;
  plannedFrom?: string;
  plannedTo?: string;
  limit?: number;
  offset?: number;
};

export const useJobServers = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: jobKeys.servers(workspaceSlug),
    queryFn: () => orpcClient.jobs.servers.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    refetchInterval: 5000
  });

export const useJobSchedules = (workspaceSlug: string, enabled = true) =>
  useQuery({
    queryKey: jobKeys.schedules(workspaceSlug),
    queryFn: () => orpcClient.jobs.schedules.list({ params: { workspace: workspaceSlug } }),
    enabled: enabled && !!workspaceSlug,
    refetchInterval: 5000
  });

export const useCreateJob = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateJobBody) =>
      orpcClient.jobs.schedules.create({
        params: { workspace: workspaceSlug },
        body
      }),
    onSuccess: async () => invalidateJobQueries(queryClient, workspaceSlug)
  });
};

export const useJobRuns = (workspaceSlug: string, filters: JobRunFilters, enabled = true) =>
  useQuery({
    queryKey: jobKeys.runs(workspaceSlug, filters),
    queryFn: () =>
      orpcClient.jobs.runs.list({
        params: { workspace: workspaceSlug },
        query: {
          scheduleId: filters.scheduleId,
          status: filters.status,
          plannedFrom: filters.plannedFrom,
          plannedTo: filters.plannedTo,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0
        }
      }),
    enabled: enabled && !!workspaceSlug,
    refetchInterval: 5000
  });

export const useCancelJobRun = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      orpcClient.jobs.runs.cancel({
        params: { workspace: workspaceSlug, id: runId }
      }),
    onSuccess: () => invalidateJobQueries(queryClient, workspaceSlug)
  });
};
