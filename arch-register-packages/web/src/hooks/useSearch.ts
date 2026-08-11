import { useQuery } from '@tanstack/react-query';
import {
  documentSearchQuery,
  searchKeys as searchKeysFromQueries,
  searchQuery,
  type SearchTypes
} from '../queries/search';

export const searchKeys = searchKeysFromQueries;

// Hook for searching across the workspace
export const useSearch = (
  workspaceId: string,
  params: {
    q: string;
    limitPerType?: number | null;
    types?: SearchTypes | null;
  },
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery(searchQuery(workspaceId, params, queryOptions?.enabled ?? true));
};

// Hook for searching Markdown documents across the workspace (for document-link pickers)
export const useDocumentSearch = (workspaceId: string, query: string) => {
  return useQuery(documentSearchQuery(workspaceId, query));
};
