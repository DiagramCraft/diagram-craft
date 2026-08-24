import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConformanceExemptionRequest,
  ConformanceViolationListQuery,
  CreateConformanceCheck,
  UpdateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import { orpcClient } from '../lib/orpcClient';
import {
  conformanceChecksQuery,
  conformanceRunsQuery,
  conformanceSummaryQuery,
  conformanceViolationsQuery,
  invalidateConformanceQueries
} from '../queries/conformance';

export const useConformanceChecks = (workspaceSlug: string, enabled = true) =>
  useQuery(conformanceChecksQuery(workspaceSlug, enabled));

export const useConformanceRuns = (workspaceSlug: string, enabled = true) => {
  const queryClient = useQueryClient();
  const previousStatuses = useRef(new Map<string, string>());
  const query = useQuery(conformanceRunsQuery(workspaceSlug, enabled));

  useEffect(() => {
    if (!query.data) return;
    const completedRun = query.data.some(
      run => previousStatuses.current.get(run.id) === 'running' && run.status !== 'running'
    );
    previousStatuses.current = new Map(query.data.map(run => [run.id, run.status]));
    if (completedRun) void invalidateConformanceQueries(queryClient, workspaceSlug);
  }, [query.data, queryClient, workspaceSlug]);

  return query;
};

export const useConformanceSummary = (workspaceSlug: string, enabled = true) =>
  useQuery(conformanceSummaryQuery(workspaceSlug, enabled));

export const useConformanceViolations = (
  workspaceSlug: string,
  filters: ConformanceViolationListQuery,
  enabled = true
) => useQuery(conformanceViolationsQuery(workspaceSlug, filters, enabled));

export const useCreateConformanceCheck = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConformanceCheck) =>
      orpcClient.conformance.checks.create({ params: { workspace: workspaceSlug }, body }),
    onSuccess: () => invalidateConformanceQueries(queryClient, workspaceSlug)
  });
};

export const useUpdateConformanceCheck = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: UpdateConformanceCheck }) =>
      orpcClient.conformance.checks.update({
        params: { workspace: workspaceSlug, id: input.id },
        body: input.body
      }),
    onSuccess: () => invalidateConformanceQueries(queryClient, workspaceSlug)
  });
};

export const useDeleteConformanceCheck = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      orpcClient.conformance.checks.remove({ params: { workspace: workspaceSlug, id } }),
    onSuccess: () => invalidateConformanceQueries(queryClient, workspaceSlug)
  });
};

export const useRunConformance = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkId?: string) =>
      orpcClient.conformance.runs.start({
        params: { workspace: workspaceSlug },
        body: checkId ? { checkId } : {}
      }),
    onSuccess: () => invalidateConformanceQueries(queryClient, workspaceSlug)
  });
};

export const useExemptConformanceViolation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: ConformanceExemptionRequest }) =>
      orpcClient.conformance.violations.exempt({
        params: { workspace: workspaceSlug, id: input.id },
        body: input.body
      }),
    onSuccess: () => invalidateConformanceQueries(queryClient, workspaceSlug)
  });
};
