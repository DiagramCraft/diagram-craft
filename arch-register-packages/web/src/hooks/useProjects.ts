import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  type Project,
  type ProjectDetail
} from '../lib/api';
import { invalidateAuditQueries } from './useAudit';

// Query keys factory
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...projectKeys.lists(), workspaceId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.details(), workspaceId, projectId] as const
};

// Hook for fetching project list
export const useProjects = (workspaceId: string) => {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
    enabled: !!workspaceId
  });
};

// Hook for fetching a single project
export const useProject = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => fetchProject(workspaceId, projectId),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for creating a project
export const useCreateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      owner?: string | null;
      status?: 'pinned' | 'active' | 'archived';
      color?: string | null;
    }) => createProject(workspaceId, body),
    onSuccess: async newProject => {
      // Update project list cache with the new project
      queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) => {
        if (!old) return [newProject];
        return [...old, newProject];
      });
      await invalidateAuditQueries(queryClient, workspaceId);
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
        status?: 'pinned' | 'active' | 'archived';
        color?: string | null;
      };
    }) => updateProject(workspaceId, projectId, data),
    onSuccess: async (updatedProject, variables) => {
      // Update the project list cache
      queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(p => (p.id === variables.projectId ? updatedProject : p));
      });
      // Update the project detail cache
      queryClient.setQueryData(
        projectKeys.detail(workspaceId, variables.projectId),
        (old: ProjectDetail | undefined) => {
          if (!old) return updatedProject;
          return { ...old, ...updatedProject };
        }
      );
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for deleting a project
export const useDeleteProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(workspaceId, projectId),
    onSuccess: async () => {
      // Invalidate all project queries
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
