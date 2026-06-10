import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createDiagramFile,
  toggleTemplateStatus,
  createDiagramFromTemplate
} from '../lib/api';
import { projectKeys } from './useProjects';
import { invalidateAuditQueries } from './useAudit';
import { ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';

// Query keys factory
export const projectFileKeys = {
  all: ['project-files'] as const,
  lists: () => [...projectFileKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...projectFileKeys.lists(), workspaceId, projectId] as const
};

// Hook for fetching project files
export const useProjectFiles = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectFileKeys.list(workspaceId, projectId),
    queryFn: () =>
      orpcClient.projects.listFiles({
        params: { workspace: workspaceId, id: projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for creating a diagram file
export const useCreateDiagramFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) =>
      createDiagramFile(workspaceId, projectId, name, folder),
    onSuccess: async () => {
      // Invalidate project files to show the new file
      await queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId)
      });
      // Also invalidate the project detail which includes file count
      await queryClient.invalidateQueries({
        queryKey: projectKeys.detail(workspaceId, projectId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for creating a folder
export const useCreateFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) =>
      orpcClient.projects.createFolder({
        params: { workspace: workspaceId, id: projectId },
        body: { path }
      }),
    onSuccess: async () => {
      // Invalidate project files to show the new folder
      await queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId)
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

const invalidateProjectAndFiles = (
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  projectId: string
) => {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: projectFileKeys.list(workspaceId, projectId) }),
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) }),
    invalidateAuditQueries(queryClient, workspaceId)
  ]);
};

export const useDeleteProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filePath: string) =>
      orpcClient.projects.deleteFile({
        params: { workspace: workspaceId, id: projectId, path: filePath }
      }),
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

export const useDeleteProjectFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderPath: string) =>
      orpcClient.projects.deleteFolder({
        params: { workspace: workspaceId, id: projectId, path: folderPath }
      }),
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

export const useRenameProjectFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      orpcClient.projects.renameFolder({
        params: { workspace: workspaceId, id: projectId },
        body: { oldPath, newPath }
      }),
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

export const useCloneProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: ProjectFile) =>
      orpcClient.projects.cloneFile({
        params: { workspace: workspaceId, id: projectId, path: file.path }
      }),
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

export const useRenameProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, newName }: { file: ProjectFile; newName: string }) => {
      const folder = file.path.includes('/')
        ? file.path.substring(0, file.path.lastIndexOf('/'))
        : null;
      const newPath = folder ? `${folder}/${newName}.json` : `${newName}.json`;
      return orpcClient.projects.relocateFile({
        params: { workspace: workspaceId, id: projectId, path: file.path },
        body: { newPath }
      });
    },
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

// Hook for moving a project file to a different folder
export const useMoveProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, targetFolder }: { file: ProjectFile; targetFolder: string | null }) => {
      const fileName = file.path.includes('/')
        ? file.path.substring(file.path.lastIndexOf('/') + 1)
        : file.path;
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
      return orpcClient.projects.relocateFile({
        params: { workspace: workspaceId, id: projectId, path: file.path },
        body: { newPath }
      });
    },
    onSuccess: async () => {
      await invalidateProjectAndFiles(queryClient, workspaceId, projectId);
    }
  });
};

// Hook for fetching project templates
export const useProjectTemplates = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: ['project-templates', workspaceId, projectId],
    queryFn: () =>
      orpcClient.templates.listForProject({
        params: { workspace: workspaceId, id: projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for toggling template status
export const useToggleTemplateStatus = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filePath,
      isTemplate,
      isWorkspaceTemplate
    }: {
      filePath: string;
      isTemplate: boolean;
      isWorkspaceTemplate: boolean;
    }) => toggleTemplateStatus(workspaceId, projectId, filePath, isTemplate, isWorkspaceTemplate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId)
      });
      // Invalidate all project templates in the workspace since workspace templates are shared
      await queryClient.invalidateQueries({ queryKey: ['project-templates', workspaceId] });
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for creating diagram from template
export const useCreateDiagramFromTemplate = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      templateFile,
      folder
    }: {
      name: string;
      templateFile: ProjectFile;
      folder?: string | null;
    }) => createDiagramFromTemplate(workspaceId, projectId, name, templateFile, folder),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId)
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspaceId, projectId) });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};
