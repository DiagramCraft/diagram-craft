import { useQuery } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

// Query keys factory
export const searchKeys = {
  all: ['search'] as const,
  searches: () => [...searchKeys.all, 'query'] as const,
  workspaceSearches: (workspaceId: string) => [...searchKeys.searches(), workspaceId] as const,
  search: (
    workspaceId: string,
    query: string,
    options: {
      limitPerType?: number | null;
      types?: Array<'projects' | 'files' | 'entities' | 'schemas'> | null;
    }
  ) => [...searchKeys.workspaceSearches(workspaceId), query, options] as const
};

// Hook for searching across the workspace
export const useSearch = (
  workspaceId: string,
  params: {
    q: string;
    limitPerType?: number | null;
    types?: Array<'projects' | 'files' | 'entities' | 'schemas'> | null;
  },
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: searchKeys.search(workspaceId, params.q, params),
    queryFn: () =>
      orpcClient.search.query({
        params: { workspace: workspaceId },
        query: {
          q: params.q,
          limitPerType: params.limitPerType ?? undefined,
          types: params.types?.join(',') ?? undefined
        }
      }),
    enabled: queryOptions?.enabled ?? (!!workspaceId && !!params.q.trim()),
    // Search results can be cached for a shorter time
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};
