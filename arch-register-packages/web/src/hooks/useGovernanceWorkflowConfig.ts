import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GovernanceWorkflowConfigUpsert,
  GovernanceWorkflowConfigRow
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import { orpcClient } from '../lib/orpcClient';

export const governanceWorkflowConfigKeys = {
  all: ['governance-workflow-config'] as const,
  detail: (workspace: string) => [...governanceWorkflowConfigKeys.all, workspace] as const
};

export const useGovernanceWorkflowConfig = (workspaceSlug: string) =>
  useQuery({
    queryKey: governanceWorkflowConfigKeys.detail(workspaceSlug),
    queryFn: () =>
      orpcClient.governanceWorkflowConfig.list({ params: { workspace: workspaceSlug } }),
    enabled: !!workspaceSlug
  });

export const useUpsertGovernanceWorkflowConfig = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GovernanceWorkflowConfigUpsert) =>
      orpcClient.governanceWorkflowConfig.upsert({
        params: { workspace: workspaceSlug },
        body
      }),
    onSuccess: (row: GovernanceWorkflowConfigRow) => {
      queryClient.setQueryData(
        governanceWorkflowConfigKeys.detail(workspaceSlug),
        (
          current: Awaited<ReturnType<typeof orpcClient.governanceWorkflowConfig.list>> | undefined
        ) =>
          current
            ? { ...current, configs: [...current.configs.filter(item => item.id !== row.id), row] }
            : current
      );
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
      void queryClient.invalidateQueries({
        queryKey: governanceWorkflowConfigKeys.detail(workspaceSlug)
      });
    }
  });
};
