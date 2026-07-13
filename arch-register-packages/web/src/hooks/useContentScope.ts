import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { fetchWithAuthResponse } from '../auth/authClient';
import { orpcClient } from '../lib/orpcClient';
import { emptyDiagram, prepareTemplateDiagramDocument } from '../lib/diagramDocuments';
import { movePath, renamePath } from '../lib/contentPath';
import {
  entityContentKeys,
  invalidateAuditQueries,
  invalidateProjectQueries,
  projectEntityKeys,
  projectFileKeys,
  workspaceContentKeys
} from './queryKeys';

export type ContentScope =
  | { kind: 'project'; workspaceId: string; projectId: string }
  | { kind: 'entity'; workspaceId: string; entityId: string }
  | { kind: 'workspace'; workspaceId: string };

const noRetryOnClientError = (_: number, error: unknown) => {
  const status = (error as { status?: number })?.status;
  return status === undefined || status >= 500;
};

export const uploadContentFile = async (
  url: string,
  file: File,
  path: string
): Promise<ProjectFile> => {
  const body = new FormData();
  body.append('file', file, file.name);
  const response = await fetchWithAuthResponse(`${url}?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    body
  });
  if (!response.ok) throw new Error(await response.text().catch(() => response.statusText));
  return response.json() as Promise<ProjectFile>;
};

export const contentScopeReady = (scope: ContentScope) =>
  !!scope.workspaceId &&
  (scope.kind === 'workspace' || (scope.kind === 'project' ? !!scope.projectId : !!scope.entityId));

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

export const contentUploadUrl = (scope: ContentScope): string => {
  switch (scope.kind) {
    case 'project':
      return `/api/${scope.workspaceId}/projects/${scope.projectId}/files/upload`;
    case 'entity':
      return `/api/${scope.workspaceId}/entities/${scope.entityId}/content/files/upload`;
    case 'workspace':
      return `/api/${scope.workspaceId}/content/files/upload`;
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
  switch (scope.kind) {
    case 'project':
      return invalidateProjectQueries(client, scope.workspaceId, scope.projectId);
    case 'entity':
      await Promise.all([
        client.invalidateQueries({
          queryKey: entityContentKeys.all(scope.workspaceId, scope.entityId)
        }),
        client.invalidateQueries({
          queryKey: projectEntityKeys.entityDiagramFiles(scope.workspaceId, scope.entityId)
        }),
        invalidateAuditQueries(client, scope.workspaceId)
      ]);
      return;
    case 'workspace':
      await Promise.all([
        client.invalidateQueries({ queryKey: workspaceContentKeys.all(scope.workspaceId) }),
        invalidateAuditQueries(client, scope.workspaceId)
      ]);
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

const createDiagramFile = (scope: ContentScope, path: string, content: Record<string, unknown>) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.saveFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path },
        body: content
      });
    case 'entity':
      return orpcClient.projects.createEntityFile({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path },
        body: content
      });
    case 'workspace':
      return orpcClient.projects.createWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path },
        body: content
      });
  }
};

const diagramPath = (name: string, folder?: string | null) =>
  folder ? `${folder}/${name}.json` : `${name}.json`;

export const deleteContentFile = (scope: ContentScope, path: string) => {
  switch (scope.kind) {
    case 'project':
      return orpcClient.projects.deleteFile({
        params: { workspace: scope.workspaceId, id: scope.projectId },
        query: { path }
      });
    case 'entity':
      return orpcClient.projects.deleteEntityFile({
        params: { workspace: scope.workspaceId, entityId: scope.entityId },
        query: { path }
      });
    case 'workspace':
      return orpcClient.projects.deleteWorkspaceFile({
        params: { workspace: scope.workspaceId },
        query: { path }
      });
  }
};

export const useContentFile = (workspaceId: string, fileId: string) =>
  useQuery({
    queryKey: projectFileKeys.detail(workspaceId, fileId),
    queryFn: () => orpcClient.projects.getFile({ params: { workspace: workspaceId, fileId } }),
    enabled: !!workspaceId && !!fileId,
    retry: noRetryOnClientError,
    refetchOnMount: true
  });

export const useContentFileContent = (workspaceId: string, fileId: string) =>
  useQuery({
    queryKey: projectFileKeys.content(workspaceId, fileId),
    queryFn: () =>
      orpcClient.projects.getDiagramContent({ params: { workspace: workspaceId, fileId } }),
    enabled: !!workspaceId && !!fileId,
    retry: noRetryOnClientError,
    refetchOnMount: true
  });

export const useContentTree = (scope: ContentScope, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: contentScopeKey(scope),
    queryFn: () => listContent(scope),
    enabled: (options?.enabled ?? true) && contentScopeReady(scope)
  });

export const useContentScopeOperations = (scope: ContentScope) => {
  const client = useQueryClient();
  const onSuccess = () => invalidateContentScope(client, scope);

  const createFolder = useMutation({
    mutationFn: (path: string) => {
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.createFolder({
            params: { workspace: scope.workspaceId, id: scope.projectId },
            body: { path }
          });
        case 'entity':
          return orpcClient.projects.createEntityFolder({
            params: { workspace: scope.workspaceId, entityId: scope.entityId },
            body: { path }
          });
        case 'workspace':
          return orpcClient.projects.createWorkspaceFolder({
            params: { workspace: scope.workspaceId },
            body: { path }
          });
      }
    },
    onSuccess
  });

  const createDiagram = useMutation({
    mutationFn: ({
      name,
      folder,
      content
    }: {
      name: string;
      folder?: string | null;
      content?: Record<string, unknown>;
    }) =>
      createDiagramFile(
        scope,
        diagramPath(name, folder),
        content ?? (emptyDiagram(name) as unknown as Record<string, unknown>)
      ),
    onSuccess
  });

  const createDiagramFromTemplate = useMutation({
    mutationFn: async ({
      name,
      templateFile,
      folder
    }: {
      name: string;
      templateFile: ProjectFile;
      folder?: string | null;
    }) => {
      const templateContent = await orpcClient.projects.getFileContent({
        params: { workspace: scope.workspaceId, id: templateFile.project_id! },
        query: { path: templateFile.path }
      });
      const content = prepareTemplateDiagramDocument(
        templateContent as unknown as SerializedDiagramDocument & { name?: string },
        name
      );
      return createDiagramFile(
        scope,
        diagramPath(name, folder),
        content as unknown as Record<string, unknown>
      );
    },
    onSuccess
  });

  const createMarkdown = useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) => {
      const body = { name, ...(folder ? { folder } : {}) };
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.createProjectMarkdown({
            params: { workspace: scope.workspaceId, id: scope.projectId },
            body
          });
        case 'entity':
          return orpcClient.projects.createEntityMarkdown({
            params: { workspace: scope.workspaceId, entityId: scope.entityId },
            body
          });
        case 'workspace':
          return orpcClient.projects.createWorkspaceMarkdown({
            params: { workspace: scope.workspaceId },
            body
          });
      }
    },
    onSuccess
  });

  const upload = useMutation({
    mutationFn: ({ file, folder }: { file: File; folder?: string | null }) => {
      const path = folder ? `${folder}/${file.name}` : file.name;
      return uploadContentFile(contentUploadUrl(scope), file, path);
    },
    onSuccess
  });

  const deleteFile = useMutation({
    mutationFn: (path: string) => deleteContentFile(scope, path),
    onSuccess
  });

  const deleteFolder = useMutation({
    mutationFn: (path: string) => {
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.deleteFolder({
            params: { workspace: scope.workspaceId, id: scope.projectId },
            query: { path }
          });
        case 'entity':
          return orpcClient.projects.deleteEntityFolder({
            params: { workspace: scope.workspaceId, entityId: scope.entityId },
            query: { path }
          });
        case 'workspace':
          return orpcClient.projects.deleteWorkspaceFolder({
            params: { workspace: scope.workspaceId },
            query: { path }
          });
      }
    },
    onSuccess
  });

  const renameFolder = useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
      const body = { oldPath, newPath };
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.renameFolder({
            params: { workspace: scope.workspaceId, id: scope.projectId },
            body
          });
        case 'entity':
          return orpcClient.projects.renameEntityFolder({
            params: { workspace: scope.workspaceId, entityId: scope.entityId },
            body
          });
        case 'workspace':
          return orpcClient.projects.renameWorkspaceFolder({
            params: { workspace: scope.workspaceId },
            body
          });
      }
    },
    onSuccess
  });

  const relocate = ({ file, newPath }: { file: ProjectFile; newPath: string }) => {
    const query = { path: file.path };
    const body = { newPath };
    switch (scope.kind) {
      case 'project':
        return orpcClient.projects.relocateFile({
          params: { workspace: scope.workspaceId, id: scope.projectId },
          query,
          body
        });
      case 'entity':
        return orpcClient.projects.relocateEntityFile({
          params: { workspace: scope.workspaceId, entityId: scope.entityId },
          query,
          body
        });
      case 'workspace':
        return orpcClient.projects.relocateWorkspaceFile({
          params: { workspace: scope.workspaceId },
          query,
          body
        });
    }
  };

  const renameFile = useMutation({
    mutationFn: ({ file, newName }: { file: ProjectFile; newName: string }) =>
      relocate({ file, newPath: renamePath(file, newName) }),
    onSuccess
  });

  const moveFile = useMutation({
    mutationFn: ({ file, targetFolder }: { file: ProjectFile; targetFolder: string | null }) =>
      relocate({ file, newPath: movePath(file.path, targetFolder) }),
    onSuccess
  });

  const cloneFile = useMutation({
    mutationFn: (file: ProjectFile) => {
      const query = { path: file.path };
      switch (scope.kind) {
        case 'project':
          return orpcClient.projects.cloneFile({
            params: { workspace: scope.workspaceId, id: scope.projectId },
            query
          });
        case 'entity':
          return orpcClient.projects.cloneEntityFile({
            params: { workspace: scope.workspaceId, entityId: scope.entityId },
            query
          });
        case 'workspace':
          return orpcClient.projects.cloneWorkspaceFile({
            params: { workspace: scope.workspaceId },
            query
          });
      }
    },
    onSuccess
  });

  return {
    createFolder,
    createDiagram,
    createDiagramFromTemplate,
    createMarkdown,
    upload,
    deleteFile,
    deleteFolder,
    renameFolder,
    renameFile,
    moveFile,
    cloneFile
  };
};
