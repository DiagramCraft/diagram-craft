export const discussionKeys = {
  all: ['discussions'] as const,
  lists: () => [...discussionKeys.all, 'list'] as const,
  list: (workspaceId: string, objectType: string, objectId: string) =>
    [...discussionKeys.lists(), workspaceId, objectType, objectId] as const,
  summary: (workspaceId: string) => [...discussionKeys.all, 'summary', workspaceId] as const
};
