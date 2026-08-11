import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateJobBody, JobScheduleUpdate } from '@arch-register/api-types/jobsContract';
import { orpcClient } from '../lib/orpcClient';
import {
  invalidateJobQueries,
  jobRunsQuery,
  jobSchedulesQuery,
  jobServersQuery,
  type JobRunFilters
} from '../queries/jobs';

export type { JobRunFilters } from '../queries/jobs';

export const useJobServers = (workspaceSlug: string, enabled = true) =>
  useQuery(jobServersQuery(workspaceSlug, enabled));

export const useJobSchedules = (workspaceSlug: string, enabled = true) =>
  useQuery(jobSchedulesQuery(workspaceSlug, enabled));

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
  useQuery(jobRunsQuery(workspaceSlug, filters, enabled));

export const useUpdateJobSchedule = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; body: JobScheduleUpdate }) =>
      orpcClient.jobs.schedules.update({
        params: { workspace: workspaceSlug, id: input.id },
        body: input.body
      }),
    onSuccess: () => invalidateJobQueries(queryClient, workspaceSlug)
  });
};

export const useRunJobScheduleNow = (workspaceSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      orpcClient.jobs.schedules.runNow({
        params: { workspace: workspaceSlug, id: scheduleId }
      }),
    onSuccess: () => invalidateJobQueries(queryClient, workspaceSlug)
  });
};

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
