import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { fetchWithAuthResponse } from '../auth/authClient';
import { orpcClient } from '../lib/orpcClient';
import { movePath, renamePath } from '../lib/contentPath';
import {
  entityContentKeys,
  invalidateProjectQueries,
  projectFileKeys,
  workspaceContentKeys
} from './queryKeys';

export type ContentScope =
  | { kind: 'project'; workspaceId: string; projectId: string }
  | { kind: 'entity'; workspaceId: string; entityId: string }
  | { kind: 'workspace'; workspaceId: string };

const uploadFile = async (url: string, file: File, path: string): Promise<ProjectFile> => {
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetchWithAuthResponse(`${url}?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body
  });
  if (!response.ok) throw new Error(await response.text().catch(() => response.statusText));
  return response.json() as Promise<ProjectFile>;
};

export const contentScopeKey = (scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return projectFileKeys.list(scope.workspaceId, scope.projectId);
    case 'entity':
      return entityContentKeys.all(scope.workspaceId, scope.entityId);
    case 'workspace':
      return workspaceContentKeys.all(scope.workspaceId);
  }
};

export const contentDownloadUrl = (scope: ContentScope, path: string): string => {
  const encodedPath = encodeURIComponent(path);
  switch (scope.kind) {
    case 'project':
      return `/api/${scope.workspaceId}/projects/${scope.projectId}/files/download?path=${encodedPath}`;
    case 'entity':
      return `/api/${scope.workspaceId}/entities/${scope.entityId}/content/files/download?path=${encodedPath}`;
    case 'workspace':
      return `/api/${scope.workspaceId}/content/files/download?path=${encodedPath}`;
  }
};

export const invalidateContentScope = async (client: QueryClient, scope: ContentScope) => {
  if (scope.kind === 'project') {
    await invalidateProjectQueries(client, scope.workspaceId, scope.projectId);
  } else {
    await client.invalidateQueries({ queryKey: contentScopeKey(scope) });
  }
};

const listContent = (scope: ContentScope) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.listFiles({
        params: { workspace: scope.workspaceId, id: scope.projectId }
      });
    case 'entity':
      return orpcClient.projects.listEntityFiles({
        params: { workspace: scope.workspaceId, entityId: scope.entityId }
      });
    case 'workspace':
      return orpcClient.projects.listWorkspaceFiles({ params: { workspace: scope.workspaceId } });
  }
};

export const useContentTree = (scope: ContentScope, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: contentScopeKey(scope),
    queryFn: () => listContent(scope),
    enabled: (options?.enabled ?? true) && !!scope.workspaceId
  });

export const useContentScopeOperations = (scope: ContentScope) => {
  const client = useQueryClient();
  const onSuccess = () => invalidateContentScope(client, scope);

  const createFolder = useMutation({
    mutationFn: (path: string) => {
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.createFolder({
            params: { workspace: scope.workspaceId, id: scope.projectId }, body: { path }
          });
        case 'entity':
          return orpcClient.projects.createEntityFolder({
            params: { workspace: scope.workspaceId, entityId: scope.entityId }, body: { path }
          });
        case 'workspace':
          return orpcClient.projects.createWorkspaceFolder({
            params: { workspace: scope.workspaceId }, body: { path }
          });
      }
    }, onSuccess
  });

  const createMarkdown = useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) => {
      const body = { name, ...(folder ? { folder } : {}) };
      switch (scope.kind) {
        case 'project': return orpcClient.projects.createProjectMarkdown({ params: { workspace: scope.workspaceId, id: scope.projectId }, body });
        case 'entity': return orpcClient.projects.createEntityMarkdown({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, body });
        case 'workspace': return orpcClient.projects.createWorkspaceMarkdown({ params: { workspace: scope.workspaceId }, body });
      }
    }, onSuccess
  });

  const upload = useMutation({
    mutationFn: ({ file, folder }: { file: File; folder?: string | null }) => {
      const path = folder ? `${folder}/${file.name}` : file.name;
      const url = scope.kind === 'project'
        ? `/api/${scope.workspaceId}/projects/${scope.projectId}/files/upload`
        : scope.kind === 'entity'
          ? `/api/${scope.workspaceId}/entities/${scope.entityId}/content/files/upload`
          : `/api/${scope.workspaceId}/content/files/upload`;
      return uploadFile(url, file, path);
    }, onSuccess
  });

  const deleteFile = useMutation({ mutationFn: (path: string) => {
    switch (scope.kind) {
      case 'project': return orpcClient.projects.deleteFile({ params: { workspace: scope.workspaceId, id: scope.projectId }, query: { path } });
      case 'entity': return orpcClient.projects.deleteEntityFile({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, query: { path } });
      case 'workspace': return orpcClient.projects.deleteWorkspaceFile({ params: { workspace: scope.workspaceId }, query: { path } });
    }
  }, onSuccess });

  const deleteFolder = useMutation({ mutationFn: (path: string) => {
    switch (scope.kind) {
      case 'project': return orpcClient.projects.deleteFolder({ params: { workspace: scope.workspaceId, id: scope.projectId }, query: { path } });
      case 'entity': return orpcClient.projects.deleteEntityFolder({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, query: { path } });
      case 'workspace': return orpcClient.projects.deleteWorkspaceFolder({ params: { workspace: scope.workspaceId }, query: { path } });
    }
  }, onSuccess });

  const renameFolder = useMutation({ mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
    const body = { oldPath, newPath };
    switch (scope.kind) {
      case 'project': return orpcClient.projects.renameFolder({ params: { workspace: scope.workspaceId, id: scope.projectId }, body });
      case 'entity': return orpcClient.projects.renameEntityFolder({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, body });
      case 'workspace': return orpcClient.projects.renameWorkspaceFolder({ params: { workspace: scope.workspaceId }, body });
    }
  }, onSuccess });

  const relocate = useMutation({ mutationFn: ({ file, newPath }: { file: ProjectFile; newPath: string }) => {
    const query = { path: file.path }; const body = { newPath };
    switch (scope.kind) {
      case 'project': return orpcClient.projects.relocateFile({ params: { workspace: scope.workspaceId, id: scope.projectId }, query, body });
      case 'entity': return orpcClient.projects.relocateEntityFile({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, query, body });
      case 'workspace': return orpcClient.projects.relocateWorkspaceFile({ params: { workspace: scope.workspaceId }, query, body });
    }
  }, onSuccess });

  const clone = useMutation({ mutationFn: (file: ProjectFile) => {
    const query = { path: file.path };
    switch (scope.kind) {
      case 'project': return orpcClient.projects.cloneFile({ params: { workspace: scope.workspaceId, id: scope.projectId }, query });
      case 'entity': return orpcClient.projects.cloneEntityFile({ params: { workspace: scope.workspaceId, entityId: scope.entityId }, query });
      case 'workspace': return orpcClient.projects.cloneWorkspaceFile({ params: { workspace: scope.workspaceId }, query });
    }
  }, onSuccess });

  return {
    createFolder, createMarkdown, upload, deleteFile, deleteFolder, renameFolder, relocate, clone,
    renameFile: (file: ProjectFile, newName: string) => relocate.mutate({ file, newPath: renamePath(file, newName) }),
    moveFile: (file: ProjectFile, targetFolder: string | null) => relocate.mutate({ file, newPath: movePath(file.path, targetFolder) })
  };
};
