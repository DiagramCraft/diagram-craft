import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type {
  WorkspaceApiTokenCreate
} from '@arch-register/api-types/apiTokenContract';

export const accountApiTokenKeys = {
  all: ['account-api-tokens'] as const,
  list: () => [...accountApiTokenKeys.all, 'list'] as const
};

export const useAccountApiTokens = () =>
  useQuery({
    queryKey: accountApiTokenKeys.list(),
    queryFn: () => orpcClient.authProtected.apiTokens.list(),
    staleTime: 30 * 1000
  });

const invalidateAccountApiTokens = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: accountApiTokenKeys.list() });
};

export const useCreateAccountApiToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: WorkspaceApiTokenCreate & { workspace: string }) =>
      orpcClient.authProtected.apiTokens.create({ body }),
    onSuccess: async () => invalidateAccountApiTokens(queryClient)
  });
};

export const useRevokeAccountApiToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => orpcClient.authProtected.apiTokens.revoke({ params: { id } }),
    onSuccess: async () => invalidateAccountApiTokens(queryClient)
  });
};
