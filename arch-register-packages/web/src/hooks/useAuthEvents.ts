import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { AuthEvent } from '@arch-register/api-types/authContract';

export const useAuthEvents = (options: { limit: number; offset: number }) =>
  useQuery<AuthEvent[]>({
    queryKey: ['auth-events', options.limit, options.offset],
    queryFn: () =>
      orpcClient.authProtected.listEvents({
        query: { limit: options.limit, offset: options.offset }
      }),
    staleTime: 15 * 1000
  });
