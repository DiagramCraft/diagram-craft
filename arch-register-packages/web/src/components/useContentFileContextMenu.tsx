import { useState, type ReactNode } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import type { useContentScopeOperations } from '../hooks/useContentScope';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  fileMenuTargetType
} from '../lib/contentNode';
import { buildContentFolderTree, type ContentFolder } from '../lib/contentPath';
import { ContentFileMenuItems } from './ContentFileMenuItems';
import { RenameDialog } from './RenameDialog';

type Operations = ReturnType<typeof useContentScopeOperations>;

/**
 * Context menu (with rename and delete dialogs) for file cards/rows outside the sidebar tree.
 * Call `open(event, file)` from an `onContextMenu` handler and render `element` once.
 */
export const useContentFileContextMenu = ({
  folders,
  operations,
  onDownload
}: {
  folders: ContentFolder[];
  operations: Operations;
  onDownload: (file: ProjectFile) => void;
}): { open: (event: React.MouseEvent, file: ProjectFile) => void; element: ReactNode } => {
  const [menu, setMenu] = useState<{ x: number; y: number; file: ProjectFile } | null>(null);
  const [renameFile, setRenameFile] = useState<ProjectFile | null>(null);
  const [deleteFile, setDeleteFile] = useState<ProjectFile | null>(null);

  const open = (event: React.MouseEvent, file: ProjectFile) => {
    if (file.read_only) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, file });
  };

  const element = (
    <>
      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <ContentFileMenuItems
            file={menu.file}
            tree={buildContentFolderTree(folders)}
            operations={operations}
            onDownload={file => {
              setMenu(null);
              onDownload(file);
            }}
            onRename={() => setRenameFile(menu.file)}
            onDelete={() => setDeleteFile(menu.file)}
          />
        </ContextMenu.Imperative>
      )}
      <RenameDialog
        open={!!renameFile}
        currentName={renameFile?.name ?? ''}
        entityType={renameFile ? entityTypeLabel(fileMenuTargetType(renameFile.type)) : 'diagram'}
        onRename={name => {
          const trimmed = name.trim();
          if (renameFile && trimmed && trimmed !== renameFile.name)
            operations.renameFile.mutate({ file: renameFile, newName: trimmed });
          setRenameFile(null);
        }}
        onCancel={() => setRenameFile(null)}
      />
      <DeleteConfirmationDialog
        open={!!deleteFile}
        title={deleteFile ? deleteTitle(fileMenuTargetType(deleteFile.type)) : ''}
        message={
          deleteFile
            ? deleteMessage({ type: fileMenuTargetType(deleteFile.type), file: deleteFile })
            : ''
        }
        detail="This can't be undone."
        confirmLabel={deleteFile ? deleteConfirmLabel(fileMenuTargetType(deleteFile.type)) : ''}
        onConfirm={() => {
          if (deleteFile) operations.deleteFile.mutate(deleteFile.path);
          setDeleteFile(null);
        }}
        onCancel={() => setDeleteFile(null)}
      />
    </>
  );

  return { open, element };
};
