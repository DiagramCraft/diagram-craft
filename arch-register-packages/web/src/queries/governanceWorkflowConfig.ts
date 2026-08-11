import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type {
  GovernanceWorkflowConfigUpsert,
  GovernanceWorkflowConfigRow
} from '@arch-register/api-types/governanceWorkflowConfigContract';
import { orpcClient } from '../lib/orpcClient';

export const governanceWorkflowConfigKeys = {
  all: ['governance-workflow-config'] as const,
  detail: (workspaceId: string) => [...governanceWorkflowConfigKeys.all, workspaceId] as const
};

export const governanceWorkflowConfigQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: governanceWorkflowConfigKeys.detail(workspaceId),
    queryFn: () => orpcClient.governanceWorkflowConfig.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

export const patchGovernanceWorkflowConfigCache = (
  queryClient: QueryClient,
  workspaceId: string,
  row: GovernanceWorkflowConfigRow
) =>
  queryClient.setQueryData(
    governanceWorkflowConfigKeys.detail(workspaceId),
    (current: Awaited<ReturnType<typeof orpcClient.governanceWorkflowConfig.list>> | undefined) =>
      current
        ? { ...current, configs: [...current.configs.filter(item => item.id !== row.id), row] }
        : current
  );

export const invalidateGovernanceWorkflowConfig = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: governanceWorkflowConfigKeys.detail(workspaceId) });

export type GovernanceWorkflowConfigMutation = GovernanceWorkflowConfigUpsert;
