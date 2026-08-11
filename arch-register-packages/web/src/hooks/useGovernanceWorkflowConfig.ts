import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GovernanceWorkflowConfigUpsert,
  GovernanceWorkflowConfigRow
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import { orpcClient } from '../lib/orpcClient';
import {
  governanceWorkflowConfigKeys as governanceWorkflowConfigKeysFromQueries,
  governanceWorkflowConfigQuery,
  invalidateGovernanceWorkflowConfig,
  patchGovernanceWorkflowConfigCache
} from '../queries/governanceWorkflowConfig';

export const governanceWorkflowConfigKeys = governanceWorkflowConfigKeysFromQueries;

export const useGovernanceWorkflowConfig = (workspaceSlug: string) =>
  useQuery(governanceWorkflowConfigQuery(workspaceSlug));

export const useUpsertGovernanceWorkflowConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GovernanceWorkflowConfigUpsert) =>
      orpcClient.governanceWorkflowConfig.upsert({
        params: { workspace: workspaceSlug },
        body
      }),
    onSuccess: (row: GovernanceWorkflowConfigRow) => {
      patchGovernanceWorkflowConfigCache(queryClient, workspaceSlug, row);
    }
  });
};

export const useResetGovernanceWorkflowConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { case_kind: string; case_subkind: string | null }) =>
      orpcClient.governanceWorkflowConfig.reset({
        params: { workspace: workspaceSlug },
        body
      }),
    onSuccess: () => {
      void invalidateGovernanceWorkflowConfig(queryClient, workspaceSlug);
    }
  });
};
