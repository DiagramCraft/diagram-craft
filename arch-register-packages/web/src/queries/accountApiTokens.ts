import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { WorkspaceApiTokenCreate } from '@arch-register/api-types/apiTokenContract';
import { orpcClient } from '../lib/orpcClient';

export const accountApiTokenKeys = {
  all: ['account-api-tokens'] as const,
  list: () => [...accountApiTokenKeys.all, 'list'] as const
};

export const accountApiTokensQuery = () =>
  queryOptions({
    queryKey: accountApiTokenKeys.list(),
    queryFn: () => orpcClient.authProtected.apiTokens.list(),
    staleTime: 30 * 1000
  });

export const invalidateAccountApiTokens = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: accountApiTokenKeys.list() });

export const createAccountApiTokenMutation = (
  queryClient: QueryClient,
  mutationFn: (body: WorkspaceApiTokenCreate & { workspace: string }) => unknown
) => ({
  mutationFn,
  onSuccess: () => invalidateAccountApiTokens(queryClient)
});

export const revokeAccountApiTokenMutation = (
  queryClient: QueryClient,
  mutationFn: (id: string) => unknown
) => ({
  mutationFn,
  onSuccess: () => invalidateAccountApiTokens(queryClient)
});
