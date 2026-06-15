import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createDiagramFromTemplate, emptyDiagram } from '../lib/api';
import { projectFileKeys, invalidateProjectQueries } from './queryKeys';
import { ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';

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
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) => {
      const fileName = `${name}.json`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;
      return orpcClient.projects.saveFile({
        params: { workspace: workspaceId, id: projectId },
        query: { path: filePath },
        body: emptyDiagram(name) as unknown as Record<string, unknown>
      });
    },
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
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
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
    }
  });
};

export const useDeleteProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filePath: string) =>
      orpcClient.projects.deleteFile({
        params: { workspace: workspaceId, id: projectId },
        query: { path: filePath }
      }),
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
    }
  });
};

export const useDeleteProjectFolder = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderPath: string) =>
      orpcClient.projects.deleteFolder({
        params: { workspace: workspaceId, id: projectId },
        query: { path: folderPath }
      }),
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
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
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
    }
  });
};

export const useCloneProjectFile = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: ProjectFile) =>
      orpcClient.projects.cloneFile({
        params: { workspace: workspaceId, id: projectId },
        query: { path: file.path }
      }),
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
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
        params: { workspace: workspaceId, id: projectId },
        query: { path: file.path },
        body: { newPath }
      });
    },
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
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
        params: { workspace: workspaceId, id: projectId },
        query: { path: file.path },
        body: { newPath }
      });
    },
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
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

// Hook for fetching workspace-level templates only (no project-specific templates)
export const useWorkspaceOnlyTemplates = (workspaceId: string) => {
  return useQuery({
    queryKey: ['workspace-templates', workspaceId],
    queryFn: async () => {
      const result = await orpcClient.templates.listAll({
        params: { workspace: workspaceId }
      });
      return result.workspaceTemplates;
    },
    enabled: !!workspaceId
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
    }) =>
      orpcClient.projects.updateTemplateStatus({
        params: { workspace: workspaceId, id: projectId },
        query: { path: filePath },
        body: { is_template: isTemplate, is_workspace_template: isWorkspaceTemplate }
      }),
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
      // Invalidate all project templates in the workspace since workspace templates are shared
      await queryClient.invalidateQueries({ queryKey: ['project-templates', workspaceId] });
    }
  });
};

export const workspaceContentKeys = {
  all: (workspaceId: string) => ['workspace-content', workspaceId] as const
};

export const useWorkspaceContentNodes = (workspaceId: string) => {
  return useQuery({
    queryKey: workspaceContentKeys.all(workspaceId),
    queryFn: () => orpcClient.projects.listWorkspaceFiles({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

export const useCreateWorkspaceFolder = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      orpcClient.projects.createWorkspaceFolder({ params: { workspace: workspaceId }, body: { path } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) });
    }
  });
};

export const useCreateWorkspaceDiagram = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) => {
      const filePath = folder ? `${folder}/${name}.json` : `${name}.json`;
      return orpcClient.projects.createWorkspaceFile({
        params: { workspace: workspaceId },
        query: { path: filePath },
        body: emptyDiagram(name) as unknown as Record<string, unknown>
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) });
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
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
    }
  });
};
