import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceApiTokenCreate } from '@arch-register/api-types/apiTokenContract';
import { orpcClient } from '../lib/orpcClient';

const keys = { list: (workspace: string) => ['workspace-api-tokens', workspace] as const };

export const useWorkspaceApiTokens = (workspace: string) =>
  useQuery({
    queryKey: keys.list(workspace),
    queryFn: () => orpcClient.config.tokens.list({ params: { workspace } }),
    enabled: !!workspace,
    staleTime: 30 * 1000
  });

export const useCreateWorkspaceApiToken = (workspace: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: WorkspaceApiTokenCreate) =>
      orpcClient.config.tokens.create({ params: { workspace }, body }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: keys.list(workspace) })
  });
};

export const useRevokeWorkspaceApiToken = (workspace: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orpcClient.config.tokens.revoke({ params: { workspace, id } }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: keys.list(workspace) })
  });
};
