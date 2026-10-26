import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { orpcClient } from '../../lib/orpcClient';
import type { ContentScope } from '../../queries/content';
import { diagramScopeOwnerId } from './diagramScreenState';

type FileTree = { folders: { files: ProjectFile[] }[]; rootFiles?: ProjectFile[] };

const findInTree = (tree: FileTree, diagramId: string): ProjectFile | null => {
  const root = tree.rootFiles?.find(file => file.id === diagramId);
  if (root) return root;
  for (const folder of tree.folders) {
    const file = folder.files.find(candidate => candidate.id === diagramId);
    if (file) return file;
  }
  return null;
};

const listScopeFiles = async (scope: ContentScope): Promise<FileTree> => {
  switch (scope.kind) {
    case 'workspace':
      return orpcClient.projects.listWorkspaceFiles({ params: { workspace: scope.workspaceId } });
    case 'entity':
      return orpcClient.projects.listEntityFiles({
        params: { workspace: scope.workspaceId, entityId: scope.entityId }
      });
    case 'project':
      return (
        await orpcClient.projects.get({
          params: { workspace: scope.workspaceId, id: scope.projectId }
        })
      ).files;
  }
};

/** Finds a diagram file in the scope's content, falling back to a direct lookup by id. */
export const findDiagramFile = async (
  scope: ContentScope,
  diagramId: string
): Promise<ProjectFile | null> => {
  const file = findInTree(await listScopeFiles(scope), diagramId);
  if (file) return file;
  // Attachment diagrams are hidden from the file tree — look them up directly by ID
  return (
    (await orpcClient.projects.getFile({
      params: { workspace: scope.workspaceId, fileId: diagramId }
    })) ?? null
  );
};

export const loadDiagramContent = (scope: ContentScope, path: string) =>
  scope.kind === 'workspace'
    ? orpcClient.projects.getWorkspaceFileContent({
        params: { workspace: scope.workspaceId },
        query: { path }
      })
    : orpcClient.projects.getFileContent({
        params: { workspace: scope.workspaceId, id: diagramScopeOwnerId(scope) },
        query: { path }
      });

export const saveDiagramContent = async (
  scope: ContentScope,
  path: string,
  body: Record<string, unknown>
) => {
  if (scope.kind === 'workspace') {
    await orpcClient.projects.saveWorkspaceFile({
      params: { workspace: scope.workspaceId },
      query: { path },
      body
    });
  } else {
    await orpcClient.projects.saveFile({
      params: { workspace: scope.workspaceId, id: diagramScopeOwnerId(scope) },
      query: { path },
      body
    });
  }
};
