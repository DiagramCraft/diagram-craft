import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcknowledgeDeprecationBody,
  CancelDeprecationBody,
  FinalizeDeprecationBody,
  PostponeDeprecationBody,
  ProposeDeprecationBody
} from '@arch-register/api-types/entityDeprecationContract';
import { orpcClient } from '../lib/orpcClient';
import { entityKeys } from '../queries/entities';
import { governanceKeys } from './useGovernance';

export const entityDeprecationKeys = {
  current: (workspace: string, entityId: string) =>
    ['entity-deprecation', workspace, entityId] as const
};

export const useEntityDeprecation = (workspace: string, entityId: string) =>
  useQuery({
    queryKey: entityDeprecationKeys.current(workspace, entityId),
    queryFn: () => orpcClient.entityDeprecations.get({ params: { workspace, id: entityId } }),
    enabled: !!workspace && !!entityId
  });

const invalidateAfterMutation = async (
  queryClient: ReturnType<typeof useQueryClient>,
  workspace: string,
  entityId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: entityDeprecationKeys.current(workspace, entityId)
    }),
    queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspace, entityId) }),
    queryClient.invalidateQueries({ queryKey: governanceKeys.all })
  ]);
};

export const useProposeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeDeprecationBody) =>
      orpcClient.entityDeprecations.propose({ params: { workspace, id: entityId }, body }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};

export const useAcknowledgeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: AcknowledgeDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.acknowledge({
        params: { workspace, id: entityId, caseId },
        body
      }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};

export const useRefreshEntityDeprecationScope = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      orpcClient.entityDeprecations.refreshScope({ params: { workspace, id: entityId, caseId } }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};

export const usePostponeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: PostponeDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.postpone({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};

export const useFinalizeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: FinalizeDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.finalize({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};

export const useCancelEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: CancelDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.cancel({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateAfterMutation(queryClient, workspace, entityId)
  });
};
