export const entityContentKeys = {
  all: (workspaceId: string, entityId: string) => ['entity-content', workspaceId, entityId] as const
};

export const workspaceContentKeys = {
  all: (workspaceId: string) => ['workspace-content', workspaceId] as const
};

export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...projectFileKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.workspaceLists(workspaceId), projectId] as const,
  detail: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'detail', workspaceId, fileId] as const,
  content: (workspaceId: string, fileId: string) =>
    [...projectFileKeys.all, 'content', workspaceId, fileId] as const
};
