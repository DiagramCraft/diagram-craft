import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { WorkspaceApiTokenCreate } from '@arch-register/api-types/apiTokenContract';
import {
  accountApiTokenKeys as accountApiTokenKeysFromQueries,
  accountApiTokensQuery,
  invalidateAccountApiTokens
} from '../queries/accountApiTokens';

export const accountApiTokenKeys = accountApiTokenKeysFromQueries;

export const useAccountApiTokens = () => useQuery(accountApiTokensQuery());

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
