export const wikiCommentKeys = {
  all: ['wikiComments'] as const,
  lists: () => [...wikiCommentKeys.all, 'list'] as const,
  list: (workspaceId: string, nodeId: string) =>
    [...wikiCommentKeys.lists(), workspaceId, nodeId] as const
};
