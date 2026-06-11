import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const useAuthConfig = () => {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: async () => {
      return await orpcClient.auth.config();
    },
    staleTime: Infinity, // Auth config doesn't change during session
    retry: false
  });
};
