import { useQuery } from '@tanstack/react-query';
import { searchArchRegisterORPC } from '../lib/searchORPCClient';

// Query keys factory
export const searchKeys = {
  all: ['search'] as const,
  searches: () => [...searchKeys.all, 'query'] as const,
  search: (
    workspaceId: string,
    query: string,
    options: {
      limitPerType?: number | null;
      types?: Array<'projects' | 'files' | 'entities' | 'schemas'> | null;
    }
  ) => [...searchKeys.searches(), workspaceId, query, options] as const
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
    queryFn: () => searchArchRegisterORPC(workspaceId, params),
    enabled: queryOptions?.enabled ?? (!!workspaceId && !!params.q.trim()),
    // Search results can be cached for a shorter time
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
};
