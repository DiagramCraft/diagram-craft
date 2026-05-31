import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  type ProjectDetail,
} from '../api';

// Query keys factory
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...projectKeys.lists(), workspaceId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.details(), workspaceId, projectId] as const,
};

// Hook for fetching project list
export const useProjects = (workspaceId: string) => {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
    enabled: !!workspaceId,
  });
};

// Hook for fetching a single project
export const useProject = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => fetchProject(workspaceId, projectId),
    enabled: !!workspaceId && !!projectId,
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
    }) => createProject(workspaceId, body),
    onSuccess: () => {
      // Invalidate project list to show the new project
      queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });
    },
  });
};

// Hook for updating a project
export const useUpdateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: {
      projectId: string;
      data: {
        name: string;
        description?: string;
        owner?: string | null;
        status?: 'pinned' | 'active' | 'archived';
        color?: string | null;
      };
    }) => updateProject(workspaceId, projectId, data),
    onSuccess: (updatedProject, variables) => {
      // Update the project detail cache
      queryClient.setQueryData(
        projectKeys.detail(workspaceId, variables.projectId),
        (old: ProjectDetail | undefined) => {
          if (!old) return updatedProject;
          return { ...old, ...updatedProject };
        }
      );
      // Invalidate project list to reflect changes
      queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });
    },
  });
};

// Hook for deleting a project
export const useDeleteProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(workspaceId, projectId),
    onSuccess: () => {
      // Invalidate all project queries
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
};
