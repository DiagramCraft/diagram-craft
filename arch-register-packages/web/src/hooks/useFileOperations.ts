import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createDiagramFromTemplate, emptyDiagram } from '../lib/diagramDocuments';
import { projectFileKeys, workspaceContentKeys } from './queryKeys';
import { ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { apiFetchResponse, ApiError } from '../lib/http';
import { type ContentScope, invalidateScope, uploadUrl } from './contentScope';

const noRetryOnClientError = (_: number, error: unknown) => {
  const status = error instanceof ApiError ? error.status : undefined;
  return status === undefined || status >= 500;
};

export const useProjectFile = (workspaceSlug: string, fileId: string) =>
  useQuery({
    queryKey: projectFileKeys.detail(workspaceSlug, fileId),
    queryFn: () =>
      orpcClient.projects.getFile({ params: { workspace: workspaceSlug, fileId } }),
    enabled: !!workspaceSlug && !!fileId,
    retry: noRetryOnClientError,
    refetchOnMount: true
  });

export const useProjectFileContent = (workspaceSlug: string, fileId: string) =>
  useQuery({
    queryKey: projectFileKeys.content(workspaceSlug, fileId),
    queryFn: () =>
      orpcClient.projects.getDiagramContent({ params: { workspace: workspaceSlug, fileId } }),
    enabled: !!workspaceSlug && !!fileId,
    retry: noRetryOnClientError,
    refetchOnMount: true
  });

// Project and workspace-root listing were the two scopes actually duplicated in this file.
// Entity content listing already has its own hook (useEntityContentNodes in useProjects.ts)
// with a matching query key, so it's left as-is rather than folded in here.
type ListableScope = Extract<ContentScope, { kind: 'project' | 'workspace' }>;

const listFiles = (scope: ListableScope) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.listFiles({
        params: { workspace: scope.workspaceId, id: scope.projectId }
      });
    case 'workspace':
      return orpcClient.projects.listWorkspaceFiles({ params: { workspace: scope.workspaceId } });
  }
};

const listKey = (scope: ListableScope) => {
  switch (scope.kind) {
    case 'project':
      return projectFileKeys.list(scope.workspaceId, scope.projectId);
    case 'workspace':
      return workspaceContentKeys.all(scope.workspaceId);
  }
};

// Hook for fetching the file tree for a project or workspace-root content area.
export const useFiles = (scope: ListableScope, options?: { enabled?: boolean }) => {
  const enabled =
    (options?.enabled ?? true) &&
    !!scope.workspaceId &&
    (scope.kind !== 'project' || !!scope.projectId);

  return useQuery({
    queryKey: listKey(scope),
    queryFn: () => listFiles(scope),
    enabled
  });
};

const createFolder = (scope: Extract<ContentScope, { kind: 'project' | 'workspace' }>, path: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.createFolder({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        body: { path }
      });
    case 'workspace':
      return orpcClient.projects.createWorkspaceFolder({
        params: { workspace: scope.workspaceId },
        body: { path }
      });
  }
};

// Folder creation only exists for project and workspace scopes today (the backend also has
// createEntityFolder, but no frontend flow calls it yet).
export const useCreateFolder = (scope: Extract<ContentScope, { kind: 'project' | 'workspace' }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => createFolder(scope, path),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const deleteFile = (scope: ContentScope, filePath: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.deleteFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path: filePath }
      });
    case 'entity':
      return orpcClient.projects.deleteEntityFile({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path: filePath }
      });
    case 'workspace':
      return orpcClient.projects.deleteWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path: filePath }
      });
  }
};

export const useDeleteFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => deleteFile(scope, filePath),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const deleteFolder = (scope: ContentScope, folderPath: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.deleteFolder({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path: folderPath }
      });
    case 'entity':
      return orpcClient.projects.deleteEntityFolder({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path: folderPath }
      });
    case 'workspace':
      return orpcClient.projects.deleteWorkspaceFolder({
        params: { workspace: scope.workspaceId },
        query: { path: folderPath }
      });
  }
};

export const useDeleteFolder = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (folderPath: string) => deleteFolder(scope, folderPath),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const renameFolder = (scope: ContentScope, oldPath: string, newPath: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.renameFolder({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        body: { oldPath, newPath }
      });
    case 'entity':
      return orpcClient.projects.renameEntityFolder({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        body: { oldPath, newPath }
      });
    case 'workspace':
      return orpcClient.projects.renameWorkspaceFolder({
        params: { workspace: scope.workspaceId },
        body: { oldPath, newPath }
      });
  }
};

export const useRenameFolder = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      renameFolder(scope, oldPath, newPath),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const cloneFile = (scope: ContentScope, path: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.cloneFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path }
      });
    case 'entity':
      return orpcClient.projects.cloneEntityFile({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path }
      });
    case 'workspace':
      return orpcClient.projects.cloneWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path }
      });
  }
};

export const useCloneFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: ProjectFile) => cloneFile(scope, file.path),
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const relocateFile = (scope: ContentScope, path: string, newPath: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.relocateFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path },
        body: { newPath }
      });
    case 'entity':
      return orpcClient.projects.relocateEntityFile({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path },
        body: { newPath }
      });
    case 'workspace':
      return orpcClient.projects.relocateWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path },
        body: { newPath }
      });
  }
};

const folderOf = (path: string) => (path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : null);
const nameOf = (path: string) => (path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path);

// Renames a diagram/markdown file, keeping its extension based on file type.
export const useRenameFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, newName }: { file: ProjectFile; newName: string }) => {
      const folder = folderOf(file.path);
      const ext = file.type === 'markdown' ? '.md' : '.json';
      const newPath = folder ? `${folder}/${newName}${ext}` : `${newName}${ext}`;
      return relocateFile(scope, file.path, newPath);
    },
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

// Renames a binary attachment, preserving whatever extension the caller passes in `newName`.
export const useRenameBinaryFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, newName }: { file: ProjectFile; newName: string }) => {
      const folder = folderOf(file.path);
      const newPath = folder ? `${folder}/${newName}` : newName;
      return relocateFile(scope, file.path, newPath);
    },
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

export const useMoveFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, targetFolder }: { file: ProjectFile; targetFolder: string | null }) => {
      const fileName = nameOf(file.path);
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
      return relocateFile(scope, file.path, newPath);
    },
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const uploadFile = async (url: string, file: File, filePath: string): Promise<ProjectFile> => {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await apiFetchResponse(`${url}?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    body: formData
  });
  return response.json() as Promise<ProjectFile>;
};

export const useUploadFile = (scope: ContentScope) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, folder }: { file: File; folder?: string | null }) => {
      const filePath = folder ? `${folder}/${file.name}` : file.name;
      return uploadFile(uploadUrl(scope), file, filePath);
    },
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

const createDiagramFile = (
  scope: Extract<ContentScope, { kind: 'project' | 'workspace' }>,
  filePath: string,
  content: Record<string, unknown>
) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.saveFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path: filePath },
        body: content
      });
    case 'workspace':
      return orpcClient.projects.createWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path: filePath },
        body: content
      });
  }
};

// Creates a diagram file in a project or workspace-root content area. Pass `content` when
// cloning existing diagram data (e.g. from a graph); otherwise a blank diagram is created.
export const useCreateDiagram = (scope: Extract<ContentScope, { kind: 'project' | 'workspace' }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      folder,
      content
    }: {
      name: string;
      folder?: string | null;
      content?: Record<string, unknown>;
    }) => {
      const filePath = folder ? `${folder}/${name}.json` : `${name}.json`;
      return createDiagramFile(scope, filePath, content ?? (emptyDiagram(name) as unknown as Record<string, unknown>));
    },
    onSuccess: () => invalidateScope(queryClient, scope)
  });
};

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
    onSuccess: () => invalidateScope(queryClient, { kind: 'project', workspaceId, projectId })
  });
};
