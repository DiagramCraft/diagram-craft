import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const wikiCommentKeys = {
  all: ['wikiComments'] as const,
  lists: () => [...wikiCommentKeys.all, 'list'] as const,
  list: (workspaceId: string, nodeId: string) =>
    [...wikiCommentKeys.lists(), workspaceId, nodeId] as const
};

export const wikiCommentsQuery = (workspaceId: string, nodeId: string, enabled = true) =>
  queryOptions({
    queryKey: wikiCommentKeys.list(workspaceId, nodeId),
    queryFn: () =>
      orpcClient.wikiComments.list({ params: { workspace: workspaceId }, query: { nodeId } }),
    enabled: enabled && !!workspaceId && !!nodeId
  });

export const invalidateWikiComments = (
  queryClient: QueryClient,
  workspaceId: string,
  nodeId: string
) => queryClient.invalidateQueries({ queryKey: wikiCommentKeys.list(workspaceId, nodeId) });
