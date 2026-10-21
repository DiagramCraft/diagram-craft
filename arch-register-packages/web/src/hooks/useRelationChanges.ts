import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateGovernanceQueries } from '../queries/governance';
import { invalidateRelationChangeQueries, relationChangeQuery } from '../queries/relationChanges';

type RelationChangeBody = {
  baseVersion: number;
  proposedState: Record<string, unknown>;
  message?: string;
  dueAt?: string;
  initiationFields?: Record<string, unknown>;
};

export const useRelationChangeApproval = (workspace: string, relationId: string) =>
  useQuery(relationChangeQuery(workspace, relationId));

export const useSubmitRelationChangeApproval = (workspace: string, relationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RelationChangeBody) =>
      orpcClient.relationChanges.submit({ params: { workspace, id: relationId }, body }),
    onSuccess: async () => {
      await Promise.all([
        invalidateRelationChangeQueries(queryClient, workspace, relationId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};

export const useResubmitRelationChangeApproval = (workspace: string, relationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { approvalId: string } & RelationChangeBody) => {
      const { approvalId, ...body } = input;
      return orpcClient.relationChanges.resubmit({
        params: { workspace, id: relationId, approvalId },
        body
      });
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateRelationChangeQueries(queryClient, workspace, relationId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};

export const useWithdrawRelationChangeApproval = (workspace: string, relationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { approvalId: string; reason?: string }) =>
      orpcClient.relationChanges.withdraw({
        params: { workspace, id: relationId, approvalId: input.approvalId },
        body: { reason: input.reason }
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidateRelationChangeQueries(queryClient, workspace, relationId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};

export const useBypassRelationApproval = (workspace: string, relationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      baseVersion: number;
      proposedState: Record<string, unknown>;
      reason: string;
    }) => orpcClient.relationChanges.bypass({ params: { workspace, id: relationId }, body }),
    onSuccess: async () => {
      await Promise.all([
        invalidateRelationChangeQueries(queryClient, workspace, relationId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};
