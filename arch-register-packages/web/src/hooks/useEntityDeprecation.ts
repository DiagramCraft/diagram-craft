import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AcknowledgeDeprecationBody,
  CancelDeprecationBody,
  FinalizeDeprecationBody,
  PostponeDeprecationBody,
  ProposeDeprecationBody
} from '@arch-register/api-types/entityDeprecationContract';
import { orpcClient } from '../lib/orpcClient';
import {
  entityDeprecationKeys as entityDeprecationKeysFromQueries,
  entityDeprecationQuery,
  invalidateEntityDeprecation
} from '../queries/entityDeprecations';

export const entityDeprecationKeys = entityDeprecationKeysFromQueries;

export const useEntityDeprecation = (workspace: string, entityId: string) =>
  useQuery(entityDeprecationQuery(workspace, entityId));

export const useProposeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeDeprecationBody) =>
      orpcClient.entityDeprecations.propose({ params: { workspace, id: entityId }, body }),
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
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
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
  });
};

export const useRefreshEntityDeprecationScope = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) =>
      orpcClient.entityDeprecations.refreshScope({ params: { workspace, id: entityId, caseId } }),
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
  });
};

export const usePostponeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: PostponeDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.postpone({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
  });
};

export const useFinalizeEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: FinalizeDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.finalize({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
  });
};

export const useCancelEntityDeprecation = (workspace: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, ...body }: CancelDeprecationBody & { caseId: string }) =>
      orpcClient.entityDeprecations.cancel({ params: { workspace, id: entityId, caseId }, body }),
    onSuccess: () => invalidateEntityDeprecation(queryClient, workspace, entityId)
  });
};
