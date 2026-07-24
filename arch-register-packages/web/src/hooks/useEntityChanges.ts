import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from '../queries/entities';
import type { EntityChangeBulkApprovalRequestBody } from '@arch-register/api-types/entityChangeContract';

export const entityChangeKeys = {
  current: (workspace: string, entityId: string) => ['entity-change', workspace, entityId] as const
};

export const useEntityChangeApproval = (workspace: string, entityId: string) =>
  useQuery({
    queryKey: entityChangeKeys.current(workspace, entityId),
    queryFn: () => orpcClient.entityChanges.get({ params: { workspace, id: entityId } }),
    enabled: !!workspace && !!entityId
  });

export const useSubmitEntityChangeApproval = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      baseVersion: number;
      proposedState: Record<string, unknown>;
      message?: string;
    }) => orpcClient.entityChanges.submit({ params: { workspace, id: entityId }, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: entityChangeKeys.current(workspace, entityId)
      });
      await queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspace, entityId) });
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
        queryClient.invalidateQueries({
          queryKey: entityChangeKeys.current(workspace, input.entityId)
        }),
        queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspace, input.entityId) }),
        queryClient.invalidateQueries({ queryKey: ['governance'] })
      ]);
    }
  });
};

export const bulkEntityChangeKeys = {
  detail: (workspace: string, approvalId: string) =>
    ['entity-change-bulk', workspace, approvalId] as const
};

export const useBulkEntityChangeApproval = (workspace: string, approvalId: string | null) =>
  useQuery({
    queryKey: bulkEntityChangeKeys.detail(workspace, approvalId ?? ''),
    queryFn: () =>
      orpcClient.entityChanges.getBulk({ params: { workspace, approvalId: approvalId! } }),
    enabled: !!workspace && !!approvalId
  });

export const useSubmitBulkEntityChangeApproval = (workspace: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EntityChangeBulkApprovalRequestBody) =>
      orpcClient.entityChanges.submitBulk({ params: { workspace }, body }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: entityKeys.workspaceLists(workspace) }),
        queryClient.invalidateQueries({ queryKey: ['governance'] })
      ]);
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
        queryClient.invalidateQueries({
          queryKey: entityChangeKeys.current(workspace, entityId)
        }),
        queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspace, entityId) }),
        queryClient.invalidateQueries({ queryKey: ['governance'] })
      ]);
    }
  });
};
