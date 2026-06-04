import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

type AuthConfig = {
  mode: 'local' | 'oidc';
};

export const useAuthConfig = () => {
  return useQuery({
    queryKey: ['auth', 'config'],
    queryFn: async () => {
      return await apiFetch<AuthConfig>(
        '/api/auth/config',
        undefined,
        { requiresAuth: false, retryOnUnauthorized: false }
      );
    },
    staleTime: Infinity, // Auth config doesn't change during session
    retry: false
  });
};
