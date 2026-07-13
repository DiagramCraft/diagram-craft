import { useCallback, useMemo } from 'react';
import {
  useContentScopeOperations,
  useContentTree,
  type ContentScope
} from '../../hooks/useContentScope';
import { useProject } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(
    file => file.id === nodeId
  );
};

// Resolves "where does this document live" (workspace root / project / entity) and provides
// the matching rename/delete mutation for that scope, so callers don't need to branch on
// projectId/entityId themselves.
export const useMarkdownDocumentScope = (params: {
  workspaceSlug: string;
  nodeId: string;
  projectId?: string;
  entityId?: string;
}) => {
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const { workspace } = useWorkspaceContext();

  const scope: ContentScope = useMemo(
    () =>
      projectId
        ? { kind: 'project', workspaceId: workspaceSlug, projectId }
        : entityId
          ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
          : { kind: 'workspace', workspaceId: workspaceSlug },
    [workspaceSlug, projectId, entityId]
  );
  const { data: contentTree } = useContentTree(scope);
  const contentOperations = useContentScopeOperations(scope);
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');

  const file = useMemo(() => findFileById(contentTree, nodeId), [contentTree, nodeId]);

  const parentLabel: string = projectId
    ? (project?.name ?? 'Project')
    : entityId
      ? (entity?._name ?? 'Entity')
      : (workspace?.name ?? workspaceSlug);

  const renameFile = useCallback(
    async (newName: string) => {
      if (!file) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === file.name) return;
      await contentOperations.renameFile.mutateAsync({ file, newName: trimmed });
    },
    [file, contentOperations.renameFile]
  );

  const deleteFile = useCallback(async () => {
    if (!file) return;
    await contentOperations.deleteFile.mutateAsync(file.path);
  }, [file, contentOperations.deleteFile]);

  return { file, parentLabel, renameFile, deleteFile };
};
