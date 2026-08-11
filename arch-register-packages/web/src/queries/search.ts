import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import type { QueryClient } from '@tanstack/react-query';

export type SearchTypes = Array<'projects' | 'files' | 'entities' | 'schemas' | 'relations'>;

export const searchKeys = {
  all: ['search'] as const,
  searches: () => [...searchKeys.all, 'query'] as const,
  workspaceSearches: (workspaceId: string) => [...searchKeys.searches(), workspaceId] as const,
  search: (
    workspaceId: string,
    query: string,
    options: { limitPerType?: number | null; types?: SearchTypes | null }
  ) => [...searchKeys.workspaceSearches(workspaceId), query, options] as const,
  documents: (workspaceId: string, query: string) =>
    [...searchKeys.workspaceSearches(workspaceId), 'documents', query] as const
};

export const searchQuery = (
  workspaceId: string,
  params: { q: string; limitPerType?: number | null; types?: SearchTypes | null },
  enabled = true
) =>
  queryOptions({
    queryKey: searchKeys.search(workspaceId, params.q, params),
    queryFn: () =>
      orpcClient.search.query({
        params: { workspace: workspaceId },
        query: {
          q: params.q,
          limitPerType: params.limitPerType ?? undefined,
          types: params.types?.join(',') === '' ? undefined : params.types?.join(',')
        }
      }),
    enabled: enabled && !!workspaceId && !!params.q.trim(),
    staleTime: 2 * 60 * 1000
  });

export const documentSearchQuery = (workspaceId: string, query: string) =>
  queryOptions({
    queryKey: searchKeys.documents(workspaceId, query),
    queryFn: () =>
      orpcClient.search.query({
        params: { workspace: workspaceId },
        query: { q: query, limitPerType: 8, types: 'files' }
      }),
    enabled: !!workspaceId && !!query.trim(),
    staleTime: 2 * 60 * 1000,
    select: data => data.files.filter(file => file.type === 'markdown')
  });

export const invalidateWorkspaceSearches = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: searchKeys.workspaceSearches(workspaceId) });
