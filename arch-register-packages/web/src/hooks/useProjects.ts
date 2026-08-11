import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  appendProjectEntityToCache,
  appendProjectToListCache,
  entityDiagramFilesQuery,
  entityProjectsQuery,
  projectDetailQuery,
  projectEntitiesQuery,
  projectsQuery,
  invalidateDeletedProject,
  invalidateProjectEntityMutation,
  invalidateProjectUpdateQueries,
  updateProjectCaches
} from '../queries/projects';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching project list
export const useProjects = (workspaceId: string) => {
  return useQuery(projectsQuery(workspaceId));
};

// Hook for fetching a single project
export const useProject = (
  workspaceId: string,
  projectId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery(projectDetailQuery(workspaceId, projectId, options?.enabled ?? true));
};

// Hook for creating a project
export const useCreateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      owner?: string | null;
      status?: 'draft' | 'active' | 'complete' | 'cancelled';
      color?: string | null;
      start_date?: string | null;
      target_date?: string | null;
    }) => orpcClient.projects.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async newProject => {
      appendProjectToListCache(queryClient, workspaceId, newProject);
      await invalidateProjectUpdateQueries(queryClient, workspaceId);
    }
  });
};

// Hook for updating a project
export const useUpdateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data
    }: {
      projectId: string;
      data: {
        name: string;
        description?: string;
        owner?: string | null;
        status?: 'draft' | 'active' | 'complete' | 'cancelled';
        color?: string | null;
        start_date?: string | null;
        target_date?: string | null;
        pinned?: boolean;
      };
    }) =>
      orpcClient.projects.update({ params: { workspace: workspaceId, id: projectId }, body: data }),
    onSuccess: async (updatedProject, variables) => {
      updateProjectCaches(queryClient, workspaceId, variables.projectId, updatedProject);
      await invalidateProjectUpdateQueries(queryClient, workspaceId);
    }
  });
};

// Hook for deleting a project
export const useDeleteProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      orpcClient.projects.remove({ params: { workspace: workspaceId, id: projectId } }),
    onSuccess: async (_, projectId) => {
      await invalidateDeletedProject(queryClient, workspaceId, projectId);
    }
  });
};

// Hook for fetching entities associated with a project
export const useProjectEntities = (workspaceId: string, projectId: string) => {
  return useQuery(projectEntitiesQuery(workspaceId, projectId));
};

// Hook for fetching projects associated with an entity
export const useEntityProjects = (workspaceId: string, entityId: string) => {
  return useQuery(entityProjectsQuery(workspaceId, entityId));
};

// Hook for adding an entity to a project
export const useAddProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { entity_id: string; entity_type?: string | null; is_done?: boolean }) =>
      orpcClient.projects.addEntity({ params: { workspace: workspaceId, id: projectId }, body }),
    onSuccess: async (createdProjectEntity, variables) => {
      appendProjectEntityToCache(queryClient, workspaceId, projectId, createdProjectEntity);
      await invalidateProjectEntityMutation(
        queryClient,
        workspaceId,
        projectId,
        variables.entity_id
      );
    }
  });
};

// Hook for updating a project entity
export const useUpdateProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityId,
      entity_type,
      is_done
    }: {
      entityId: string;
      entity_type?: string | null;
      is_done?: boolean;
    }) =>
      orpcClient.projects.updateEntity({
        params: { workspace: workspaceId, id: projectId, entityId },
        body: { entity_type, is_done }
      }),
    onSuccess: async (_, variables) => {
      await invalidateProjectEntityMutation(
        queryClient,
        workspaceId,
        projectId,
        variables.entityId
      );
    }
  });
};

// Hook for removing an entity from a project
export const useRemoveProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.projects.removeEntity({
        params: { workspace: workspaceId, id: projectId, entityId }
      }),
    onSuccess: async (_, entityId) => {
      await invalidateProjectEntityMutation(queryClient, workspaceId, projectId, entityId);
    }
  });
};

// Hook for fetching diagram files that reference an entity
export const useEntityDiagramFiles = (workspaceId: string, entityId: string) => {
  return useQuery(entityDiagramFilesQuery(workspaceId, entityId));
};
