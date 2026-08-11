import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const devKeys = {
  all: ['dev'] as const,
  config: () => [...devKeys.all, 'config'] as const,
  users: () => [...devKeys.all, 'users'] as const
};

export const devConfigQuery = () =>
  queryOptions({
    queryKey: devKeys.config(),
    queryFn: async () => {
      try {
        return await orpcClient.dev.config();
      } catch {
        return { enabled: false };
      }
    },
    staleTime: Infinity,
    retry: false
  });

export const devUsersQuery = () =>
  queryOptions({
    queryKey: devKeys.users(),
    queryFn: () => orpcClient.dev.listUsers()
  });
