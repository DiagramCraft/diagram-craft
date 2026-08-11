import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const authConfigKeys = {
  detail: ['auth', 'config'] as const
};

export const authConfigQuery = () =>
  queryOptions({
    queryKey: authConfigKeys.detail,
    queryFn: () => orpcClient.auth.config(),
    staleTime: Infinity,
    retry: false
  });
