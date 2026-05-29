import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectFiles,
  createDiagramFile,
  createFolder,
} from '../api';
import { projectKeys } from './useProjects';

// Query keys factory
export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.lists(), workspaceId, projectId] as const,
};

// Hook for fetching project files
export const useProjectFiles = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectFileKeys.list(workspaceId, projectId),
    queryFn: () => fetchProjectFiles(workspaceId, projectId),
    enabled: !!workspaceId && !!projectId,
  });
};

// Hook for creating a diagram file
export const useCreateDiagramFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) =>
      createDiagramFile(workspaceId, projectId, name, folder),
    onSuccess: () => {
      // Invalidate project files to show the new file
      queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId),
      });
      // Also invalidate the project detail which includes file count
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(workspaceId, projectId),
      });
    },
  });
};

// Hook for creating a folder
export const useCreateFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) => createFolder(workspaceId, projectId, path),
    onSuccess: () => {
      // Invalidate project files to show the new folder
      queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId),
      });
    },
  });
};
