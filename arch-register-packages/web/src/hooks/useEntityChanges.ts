import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateGovernanceQueries } from '../queries/governance';
import type { EntityChangeBulkApprovalRequestBody } from '@arch-register/api-types/entityChangeContract';
import {
  bulkEntityChangeKeys as bulkEntityChangeKeysFromQueries,
  bulkEntityChangeQuery,
  entityChangeKeys as entityChangeKeysFromQueries,
  entityChangeQuery,
  invalidateBulkEntityChangeMutation,
  invalidateEntityChangeQueries
} from '../queries/entityChanges';

export const bulkEntityChangeKeys = bulkEntityChangeKeysFromQueries;
export const entityChangeKeys = entityChangeKeysFromQueries;

export const useEntityChangeApproval = (workspace: string, entityId: string) =>
  useQuery(entityChangeQuery(workspace, entityId));

export const useSubmitEntityChangeApproval = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      baseVersion: number;
      proposedState: Record<string, unknown>;
      message?: string;
      dueAt?: string;
      initiationFields?: Record<string, unknown>;
    }) => orpcClient.entityChanges.submit({ params: { workspace, id: entityId }, body }),
    onSuccess: async () => {
      await invalidateEntityChangeQueries(queryClient, workspace, entityId);
    }
  });
};

export const useWithdrawEntityChangeApproval = (workspace: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; approvalId: string; reason?: string }) =>
      orpcClient.entityChanges.withdraw({
        params: { workspace, id: input.entityId, approvalId: input.approvalId },
        body: { reason: input.reason }
      }),
    onSuccess: async (_data, input) => {
      await Promise.all([
        invalidateEntityChangeQueries(queryClient, workspace, input.entityId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};

export const useBulkEntityChangeApproval = (workspace: string, approvalId: string | null) =>
  useQuery(bulkEntityChangeQuery(workspace, approvalId));

export const useSubmitBulkEntityChangeApproval = (workspace: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EntityChangeBulkApprovalRequestBody) =>
      orpcClient.entityChanges.submitBulk({ params: { workspace }, body }),
    onSuccess: async () => {
      await invalidateBulkEntityChangeMutation(queryClient, workspace);
    }
  });
};

export const useBypassEntityApproval = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      baseVersion: number;
      proposedState: Record<string, unknown>;
      reason: string;
    }) => orpcClient.entityChanges.bypass({ params: { workspace, id: entityId }, body }),
    onSuccess: async () => {
      await Promise.all([
        invalidateEntityChangeQueries(queryClient, workspace, entityId),
        invalidateGovernanceQueries(queryClient, workspace)
      ]);
    }
  });
};
