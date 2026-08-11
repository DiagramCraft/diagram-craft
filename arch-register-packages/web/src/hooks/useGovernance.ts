import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ListGovernanceSubmissionsQuery,
  ListGovernanceTasksQuery
} from '@arch-register/api-types/governanceContract';
import { orpcClient } from '../lib/orpcClient';
import {
  governanceCaseEventsQuery,
  governanceSubmissionsQuery,
  governanceTaskCountQuery,
  governanceTasksQuery,
  invalidateGovernanceQueries
} from '../queries/governance';
import { invalidateNotificationQueries } from '../queries/notifications';

export const useGovernanceTasks = (
  workspaceId: string,
  query: ListGovernanceTasksQuery = {},
  enabled = true
) => useQuery(governanceTasksQuery(workspaceId, query, enabled));

export const useGovernanceTaskCount = (workspaceId: string, enabled = true) =>
  useQuery(governanceTaskCountQuery(workspaceId, enabled));

export const useGovernanceCaseEvents = (
  workspaceId: string,
  caseId: string | null,
  enabled = true
) => useQuery(governanceCaseEventsQuery(workspaceId, caseId, enabled));

export const useGovernanceSubmissions = (
  workspaceId: string,
  query: ListGovernanceSubmissionsQuery = {},
  enabled = true
) => useQuery(governanceSubmissionsQuery(workspaceId, query, enabled));

export const useWithdrawGovernanceCase = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { caseId: string; reason?: string }) =>
      orpcClient.governance.cases.cancel({
        params: { workspace: workspaceId, id: input.caseId },
        body: { reason: input.reason }
      }),
    onSuccess: async () => invalidateGovernanceQueries(queryClient, workspaceId)
  });
};

export const useSendGovernanceCaseReminder = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { caseId: string }) =>
      orpcClient.governance.cases.remind({
        params: { workspace: workspaceId, id: input.caseId }
      }),
    onSuccess: async () => invalidateGovernanceQueries(queryClient, workspaceId)
  });
};

export const useDecideGovernanceAssignment = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      assignmentId: string;
      decision: 'approve' | 'reject' | 'request_changes' | 'acknowledge';
      reason?: string;
    }) =>
      orpcClient.governance.assignments.decide({
        params: { workspace: workspaceId, id: input.assignmentId },
        body: {
          decision: input.decision,
          reason: input.reason,
          idempotencyKey: crypto.randomUUID()
        }
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidateGovernanceQueries(queryClient, workspaceId),
        invalidateNotificationQueries(queryClient, workspaceId)
      ]);
    }
  });
};
