import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/http';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 5 minutes by default
        staleTime: 5 * 60 * 1000,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed requests 3 times with exponential backoff
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status === 401) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
        // Don't refetch on reconnect if data is fresh
        refetchOnReconnect: false
      },
      mutations: {
        // Mutations may be non-idempotent. Retry only when an audited operation opts in.
        retry: false
      }
    }
  });

export const queryClient = createQueryClient();
