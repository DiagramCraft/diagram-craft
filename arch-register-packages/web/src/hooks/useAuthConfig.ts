import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const authConfigKeys = {
  detail: ['auth', 'config'] as const
};

export const useAuthConfig = () => {
  return useQuery({
    queryKey: authConfigKeys.detail,
    queryFn: async () => {
      return await orpcClient.auth.config();
    },
    staleTime: Infinity, // Auth config doesn't change during session
    retry: false
  });
};
