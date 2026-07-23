import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from '../queries/entities';
import type { EntityChangeBulkProposalBody } from '@arch-register/api-types/entityChangeContract';

export const entityChangeKeys = {
  current: (workspace: string, entityId: string) => ['entity-change', workspace, entityId] as const
};

export const useEntityChangeProposal = (workspace: string, entityId: string) =>
  useQuery({
    queryKey: entityChangeKeys.current(workspace, entityId),
    queryFn: () => orpcClient.entityChanges.get({ params: { workspace, id: entityId } }),
    enabled: !!workspace && !!entityId
  });

export const useSubmitEntityChangeProposal = (workspace: string, entityId: string) => {
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

export const useWithdrawEntityChangeProposal = (workspace: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; proposalId: string; reason?: string }) =>
      orpcClient.entityChanges.withdraw({
        params: { workspace, id: input.entityId, proposalId: input.proposalId },
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
  detail: (workspace: string, proposalId: string) =>
    ['entity-change-bulk', workspace, proposalId] as const
};

export const useBulkEntityChangeProposal = (workspace: string, proposalId: string | null) =>
  useQuery({
    queryKey: bulkEntityChangeKeys.detail(workspace, proposalId ?? ''),
    queryFn: () =>
      orpcClient.entityChanges.getBulk({ params: { workspace, proposalId: proposalId! } }),
    enabled: !!workspace && !!proposalId
  });

export const useSubmitBulkEntityChangeProposal = (workspace: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EntityChangeBulkProposalBody) =>
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
