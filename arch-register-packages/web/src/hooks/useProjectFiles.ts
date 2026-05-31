import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectFiles,
  createDiagramFile,
  createFolder,
  deleteProjectFile,
  deleteProjectFolder,
  renameProjectFolder,
  cloneProjectFile,
  renameProjectFile,
} from '../api';
import type { ProjectFile } from '../api';
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

const invalidateProjectAndFiles = (queryClient: ReturnType<typeof useQueryClient>, workspaceId: string, projectId: string) => {
  queryClient.invalidateQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) });
};

export const useDeleteProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filePath: string) => deleteProjectFile(workspaceId, projectId, filePath),
    onSuccess: () => invalidateProjectAndFiles(queryClient, workspaceId, projectId),
  });
};

export const useDeleteProjectFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderPath: string) => deleteProjectFolder(workspaceId, projectId, folderPath),
    onSuccess: () => invalidateProjectAndFiles(queryClient, workspaceId, projectId),
  });
};

export const useRenameProjectFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      renameProjectFolder(workspaceId, projectId, oldPath, newPath),
    onSuccess: () => invalidateProjectAndFiles(queryClient, workspaceId, projectId),
  });
};

export const useCloneProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: ProjectFile) => cloneProjectFile(workspaceId, projectId, file),
    onSuccess: () => invalidateProjectAndFiles(queryClient, workspaceId, projectId),
  });
};

export const useRenameProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, newName }: { file: ProjectFile; newName: string }) =>
      renameProjectFile(workspaceId, projectId, file, newName),
    onSuccess: () => invalidateProjectAndFiles(queryClient, workspaceId, projectId),
  });
};
