import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import {
  invalidateWorkspaceApiTokens,
  workspaceApiTokensQuery,
  type WorkspaceApiTokenMutation
} from '../queries/workspaceApiTokens';

export const useWorkspaceApiTokens = (workspace: string) =>
  useQuery({
    ...workspaceApiTokensQuery(workspace)
  });

export const useCreateWorkspaceApiToken = (workspace: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: WorkspaceApiTokenMutation) =>
      orpcClient.config.tokens.create({ params: { workspace }, body }),
    onSuccess: async () => invalidateWorkspaceApiTokens(queryClient, workspace)
  });
};

export const useRevokeWorkspaceApiToken = (workspace: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orpcClient.config.tokens.revoke({ params: { workspace, id } }),
    onSuccess: async () => invalidateWorkspaceApiTokens(queryClient, workspace)
  });
};
