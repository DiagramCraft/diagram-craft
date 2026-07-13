import type { QueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './audit';
import { projectFileKeys } from './content';

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

export const invalidateProjectQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId),
    ...(projectId
      ? [
          queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) }),
          queryClient.invalidateQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) }),
          queryClient.invalidateQueries({ queryKey: projectEntityKeys.all(workspaceId, projectId) })
        ]
      : [])
  ]);
};

export const invalidateDeletedProject = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) }),
    queryClient.removeQueries({ queryKey: projectKeys.detail(workspaceId, projectId) }),
    queryClient.removeQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) }),
    queryClient.removeQueries({ queryKey: projectEntityKeys.all(workspaceId, projectId) }),
    queryClient.invalidateQueries({ queryKey: projectEntityKeys.entityProjectsAll(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};
