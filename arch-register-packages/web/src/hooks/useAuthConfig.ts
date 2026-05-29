import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

type AuthConfig = {
  mode: 'local' | 'oidc';
};

export const useAuthConfig = () => {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: async () => {
      const config = await apiFetch<AuthConfig>('/api/auth/config');
      return config;
    },
    staleTime: Infinity, // Auth config doesn't change during session
    retry: false,
  });
};
