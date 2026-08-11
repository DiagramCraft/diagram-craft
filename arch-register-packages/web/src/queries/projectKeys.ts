export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...projectKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => projectKeys.workspaceLists(workspaceId),
  details: () => [...projectKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...projectKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.workspaceDetails(workspaceId), projectId] as const
};

export const projectEntityKeys = {
  workspaceProjects: (workspaceId: string) => ['project-entities', workspaceId] as const,
  all: (workspaceId: string, projectId: string) =>
    [...projectEntityKeys.workspaceProjects(workspaceId), projectId] as const,
  entityProjectsAll: (workspaceId: string) => ['entity-projects', workspaceId] as const,
  entityProjects: (workspaceId: string, entityId: string) =>
    [...projectEntityKeys.entityProjectsAll(workspaceId), entityId] as const,
  entityDiagramFiles: (workspaceId: string, entityId: string) =>
    ['entity-diagram-files', workspaceId, entityId] as const
};
