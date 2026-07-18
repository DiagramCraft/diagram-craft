import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from '../queries/entities';

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
