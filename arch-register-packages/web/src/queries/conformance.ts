import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { ConformanceViolationListQuery } from '@arch-register/api-types/conformanceContract';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from './entities';

export const conformanceKeys = {
  all: ['conformance'] as const,
  checks: (workspaceId: string) => [...conformanceKeys.all, 'checks', workspaceId] as const,
  runs: (workspaceId: string) => [...conformanceKeys.all, 'runs', workspaceId] as const,
  summary: (workspaceId: string) => [...conformanceKeys.all, 'summary', workspaceId] as const,
  violations: (workspaceId: string, filters: Record<string, unknown>) =>
    [...conformanceKeys.all, 'violations', workspaceId, filters] as const,
  violationEvents: (workspaceId: string, violationId: string) =>
    [...conformanceKeys.all, 'violation-events', workspaceId, violationId] as const
};

export const conformanceChecksQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: conformanceKeys.checks(workspaceId),
    queryFn: () => orpcClient.conformance.checks.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 15_000
  });

export const conformanceRunsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: conformanceKeys.runs(workspaceId),
    queryFn: () => orpcClient.conformance.runs.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 5_000
  });

export const conformanceSummaryQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: conformanceKeys.summary(workspaceId),
    queryFn: () => orpcClient.conformance.summary({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 15_000
  });

export const conformanceViolationsQuery = (
  workspaceId: string,
  filters: ConformanceViolationListQuery,
  enabled = true
) =>
  queryOptions({
    queryKey: conformanceKeys.violations(workspaceId, filters),
    queryFn: () =>
      orpcClient.conformance.violations.list({
        params: { workspace: workspaceId },
        query: filters
      }),
    enabled: enabled && !!workspaceId,
    refetchInterval: 15_000
  });

export const conformanceViolationEventsQuery = (
  workspaceId: string,
  violationId: string,
  enabled = true
) =>
  queryOptions({
    queryKey: conformanceKeys.violationEvents(workspaceId, violationId),
    queryFn: () =>
      orpcClient.conformance.violations.events({
        params: { workspace: workspaceId, id: violationId }
      }),
    enabled: enabled && !!workspaceId && !!violationId
  });

export const invalidateConformanceQueries = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: conformanceKeys.checks(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: conformanceKeys.runs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: conformanceKeys.summary(workspaceId) }),
    queryClient.invalidateQueries({
      queryKey: [...conformanceKeys.all, 'violations', workspaceId]
    }),
    queryClient.invalidateQueries({
      queryKey: [...conformanceKeys.all, 'violation-events', workspaceId]
    }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.counts(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.trees(workspaceId) })
  ]);
