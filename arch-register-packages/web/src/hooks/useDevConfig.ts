import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const devConfigKeys = {
  detail: ['dev', 'config'] as const
};

export const useDevConfig = () => {
  return useQuery({
    queryKey: devConfigKeys.detail,
    queryFn: async () => {
      try {
        return await orpcClient.dev.config();
      } catch {
        // Router isn't mounted (dev tooling disabled) -> treat as disabled.
        return { enabled: false };
      }
    },
    staleTime: Infinity,
    retry: false
  });
};
