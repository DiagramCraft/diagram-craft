import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries } from './useAudit';
import { Project, ProjectDetail } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';

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
    queryFn: () => orpcClient.projects.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

// Hook for fetching a single project
export const useProject = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => orpcClient.projects.get({ params: { workspace: workspaceId, id: projectId } }),
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
    }) => orpcClient.projects.create({ params: { workspace: workspaceId }, body }),
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
    }) => orpcClient.projects.update({ params: { workspace: workspaceId, id: projectId }, body: data }),
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
    mutationFn: (projectId: string) =>
      orpcClient.projects.remove({ params: { workspace: workspaceId, id: projectId } }),
    onSuccess: async () => {
      // Invalidate all project queries
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
