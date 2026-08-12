import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Project, ProjectDetail } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { invalidateAuditQueries } from './audit';
import { projectFileKeys } from './content';
import { invalidateEntityQueries } from './entities';
import {
  projectEntityKeys as projectEntityKeysFromQueries,
  projectKeys as projectKeysFromQueries
} from './projectKeys';
import { orpcClient } from '../lib/orpcClient';
import { fetchEntityProjects } from '../lib/projectOperations';

export const projectKeys = projectKeysFromQueries;
export const projectEntityKeys = projectEntityKeysFromQueries;

export const projectsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => orpcClient.projects.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });

export const projectDetailQuery = (workspaceId: string, projectId: string, enabled = true) =>
  queryOptions({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => orpcClient.projects.get({ params: { workspace: workspaceId, id: projectId } }),
    enabled: enabled && !!workspaceId && !!projectId
  });

export const projectEntitiesQuery = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: projectEntityKeys.all(workspaceId, projectId),
    queryFn: () =>
      orpcClient.projects.listEntities({ params: { workspace: workspaceId, id: projectId } }),
    enabled: !!workspaceId && !!projectId
  });

export const entityProjectsQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: projectEntityKeys.entityProjects(workspaceId, entityId),
    queryFn: () => fetchEntityProjects(workspaceId, entityId),
    enabled: !!workspaceId && !!entityId
  });

export const entityDiagramFilesQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, entityId),
    queryFn: () =>
      orpcClient.projects.getEntityDiagramFiles({
        params: { workspace: workspaceId, entityId }
      }),
    enabled: !!workspaceId && !!entityId
  });

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

export const invalidateProjectList = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });

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

export const appendProjectToListCache = (
  queryClient: QueryClient,
  workspaceId: string,
  project: Project
) => {
  queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) =>
    old ? [...old, project] : [project]
  );
};

export const updateProjectCaches = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  project: Project
) => {
  queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) =>
    old?.map(item => (item.id === projectId || item.public_id === projectId ? project : item))
  );
  queryClient.setQueryData(
    projectKeys.detail(workspaceId, project.public_id),
    (old: ProjectDetail | undefined) => (old ? { ...old, ...project } : project)
  );
};

export const invalidateProjectUpdateQueries = async (
  queryClient: QueryClient,
  workspaceId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: projectEntityKeys.entityProjectsAll(workspaceId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);

export const appendProjectEntityToCache = (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  projectEntity: ProjectEntity
) => {
  queryClient.setQueryData<ProjectEntity[] | undefined>(
    projectEntityKeys.all(workspaceId, projectId),
    old => {
      if (!old) return [projectEntity];
      if (old.some(entity => entity.entity_id === projectEntity.entity_id)) return old;
      return [...old, projectEntity];
    }
  );
};

export const invalidateProjectEntityMutation = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  entityId: string
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: projectEntityKeys.all(workspaceId, projectId) }),
    queryClient.invalidateQueries({
      queryKey: projectEntityKeys.entityProjects(workspaceId, entityId)
    }),
    invalidateEntityQueries(queryClient, workspaceId)
  ]);
