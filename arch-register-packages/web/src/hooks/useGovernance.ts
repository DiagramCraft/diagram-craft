import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListGovernanceTasksQuery } from '@arch-register/api-types/governanceContract';
import { orpcClient } from '../lib/orpcClient';

export const governanceKeys = {
  all: ['governance'] as const,
  tasks: (workspaceId: string, query: ListGovernanceTasksQuery = {}) =>
    [...governanceKeys.all, 'tasks', workspaceId, query] as const,
  count: (workspaceId: string) => [...governanceKeys.all, 'count', workspaceId] as const
};

export const useGovernanceTasks = (
  workspaceId: string,
  query: ListGovernanceTasksQuery = {},
  enabled = true
) =>
  useQuery({
    queryKey: governanceKeys.tasks(workspaceId, query),
    queryFn: () =>
      orpcClient.governance.assignments.mine({ params: { workspace: workspaceId }, query }),
    enabled: enabled && !!workspaceId,
    staleTime: 15 * 1000
  });

export const useGovernanceTaskCount = (workspaceId: string, enabled = true) =>
  useQuery({
    queryKey: governanceKeys.count(workspaceId),
    queryFn: () => orpcClient.governance.assignments.count({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 15 * 1000
  });

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
        queryClient.invalidateQueries({ queryKey: governanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      ]);
    }
  });
};
