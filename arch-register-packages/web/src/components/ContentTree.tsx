import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import {
  TbCopy,
  TbDownload,
  TbFileText,
  TbFolder,
  TbFolderOpen,
  TbFolderSymlink,
  TbPencil,
  TbPlus,
  TbTrash,
  TbUpload
} from 'react-icons/tb';
import type { useContentScopeOperations } from '../hooks/useContentScope';
import {
  buildContentFolderTree,
  findContentFilePath,
  parentPath,
  type ContentFolder,
  type ContentFolderNode
} from '../lib/contentPath';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  fileMenuTargetType,
  getFileNodeIcon,
  type MenuTarget
} from '../lib/contentNode';
import { TreeRow } from './TreeRow';
import { RenameDialog } from './RenameDialog';
import { ICON_MAP } from './TypeBadge';
import type { SchemaIconId } from '../lib/schemaPresentation';

type Operations = ReturnType<typeof useContentScopeOperations>;

type Props = {
  rootFiles: ProjectFile[];
  folders: ContentFolder[];
  activeFileId: string | null;
  activeFolder: string | null;
  operations: Operations;
  onFolderClick: (path: string) => void;
  onFileClick: (file: ProjectFile) => void;
  onDownload: (file: ProjectFile) => void;
  onCreateFolder: (parent: string) => void;
  onCreateDiagram: (folder: string) => void;
  onCreateMarkdown: (folder: string) => void;
  onMountContextMenu?: (event: React.MouseEvent, mountId: string) => void;
  initiallyExpanded?: boolean;
  beforeTree?: ReactNode;
};

export type ContentTreeHandle = { openUpload: (folder: string | null) => void };

export const ContentTree = forwardRef<ContentTreeHandle, Props>(function ContentTree(
  {
    rootFiles,
    folders,
    activeFileId,
    activeFolder,
    operations,
    onFolderClick,
    onFileClick,
    onDownload,
    onCreateFolder,
    onCreateDiagram,
    onCreateMarkdown,
    initiallyExpanded = false,
    beforeTree,
    onMountContextMenu
  },
  ref
) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [renameTarget, setRenameTarget] = useState<MenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuTarget | null>(null);
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tree = buildContentFolderTree(folders);
  const activePath = findContentFilePath(rootFiles, folders, activeFileId);

  const isExpanded = (path: string) =>
    activePath?.startsWith(`${path}/`) ||
    (initiallyExpanded ? !collapsed.has(path) : expanded.has(path));

  const toggle = (path: string) => {
    if (initiallyExpanded) {
      setCollapsed(previous => {
        const next = new Set(previous);
        next.has(path) ? next.delete(path) : next.add(path);
        return next;
      });
    } else {
      setExpanded(previous => {
        const next = new Set(previous);
        next.has(path) ? next.delete(path) : next.add(path);
        return next;
      });
    }
  };

  const openUpload = (folder: string | null) => {
    setUploadFolder(folder);
    fileInputRef.current?.click();
  };
  useImperativeHandle(ref, () => ({ openUpload }));

  const renderMoveNodes = (
    file: ProjectFile,
    nodes: ContentFolderNode[],
    current: string | null
  ): ReactNode =>
    nodes.map(node =>
      node.children.length ? (
        <Menu.SubMenu key={node.path} label={node.name} leftSlot={<TbFolder size={13} />}>
          <Menu.Item
            disabled={node.path === current}
            leftSlot={<TbFolder size={13} />}
            onClick={() => operations.moveFile.mutate({ file, targetFolder: node.path })}
          >
            {node.name}
          </Menu.Item>
          {renderMoveNodes(file, node.children, current)}
        </Menu.SubMenu>
      ) : (
        <Menu.Item
          key={node.path}
          disabled={node.path === current}
          leftSlot={<TbFolder size={13} />}
          onClick={() => operations.moveFile.mutate({ file, targetFolder: node.path })}
        >
          {node.name}
        </Menu.Item>
      )
    );

  const renderMenu = (target: MenuTarget) => {
    if (target.type === 'folder')
      return (
        <>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => {
              setMenu(null);
              onCreateDiagram(target.path);
            }}
          >
            New diagram
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => {
              setMenu(null);
              onCreateFolder(target.path);
            }}
          >
            New folder
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbUpload size={13} />}
            onClick={() => {
              setMenu(null);
              openUpload(target.path);
            }}
          >
            Upload file
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFileText size={13} />}
            onClick={() => {
              setMenu(null);
              onCreateMarkdown(target.path);
            }}
          >
            New wiki page
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item leftSlot={<TbPencil size={13} />} onClick={() => setRenameTarget(target)}>
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteTarget(target)}
          >
            Delete
          </Menu.Item>
        </>
      );

    const current = parentPath(target.file.path);
    return (
      <>
        {target.type === 'file' && (
          <>
            <Menu.Item
              leftSlot={<TbDownload size={13} />}
              onClick={() => {
                setMenu(null);
                onDownload(target.file);
              }}
            >
              Download
            </Menu.Item>
            <Menu.Separator />
          </>
        )}
        {target.type === 'diagram' && (
          <>
            <Menu.Item
              leftSlot={<TbCopy size={13} />}
              onClick={() => operations.cloneFile.mutate(target.file)}
            >
              Clone
            </Menu.Item>
            <Menu.Separator />
          </>
        )}
        <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
          <Menu.Item
            disabled={current === null}
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => operations.moveFile.mutate({ file: target.file, targetFolder: null })}
          >
            Root
          </Menu.Item>
          {renderMoveNodes(target.file, tree, current)}
        </Menu.SubMenu>
        <Menu.Item leftSlot={<TbPencil size={13} />} onClick={() => setRenameTarget(target)}>
          Rename
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item
          type="danger"
          leftSlot={<TbTrash size={13} />}
          onClick={() => setDeleteTarget(target)}
        >
          Delete
        </Menu.Item>
      </>
    );
  };

  const fileRow = (file: ProjectFile, depth?: number) => {
    const documentTypeIcon = file.document_type_icon;
    const DocumentTypeIcon = documentTypeIcon
      ? ICON_MAP[documentTypeIcon as SchemaIconId]
      : undefined;

    return (
      <TreeRow
        key={file.id}
        depth={depth}
        icon={
          file.type === 'markdown' && DocumentTypeIcon ? (
            <DocumentTypeIcon size={13} />
          ) : (
            getFileNodeIcon(file.type)
          )
        }
        label={file.original_filename ?? file.name}
        active={file.id === activeFileId}
        onClick={() => (file.type === 'file' ? onDownload(file) : onFileClick(file))}
        onContextMenu={
          file.read_only
            ? undefined
            : event => {
                event.preventDefault();
                event.stopPropagation();
                setMenu({
                  x: event.clientX,
                  y: event.clientY,
                  target: { type: fileMenuTargetType(file.type), file }
                });
              }
        }
      />
    );
  };

  const folderNode = (node: ContentFolderNode, depth = 0): ReactNode => {
    const open = isExpanded(node.path);
    return (
      <div key={node.path}>
        <TreeRow
          icon={
            node.read_only && parentPath(node.path) === null ? (
              <TbFolderSymlink size={13} />
            ) : (
              <TbFolder size={13} />
            )
          }
          label={node.name}
          expandable
          expanded={open}
          active={activeFolder === node.path}
          depth={depth}
          onExpand={() => toggle(node.path)}
          onClick={() => onFolderClick(node.path)}
          onContextMenu={
            node.read_only
              ? node.mount_id && parentPath(node.path) === null && onMountContextMenu
                ? event => onMountContextMenu(event, node.mount_id!)
                : undefined
              : event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    target: { type: 'folder', path: node.path }
                  });
                }
          }
        />
        {open && (
          <>
            {node.files.map(file => fileRow(file, depth + 1))}
            {node.children.map(child => folderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {beforeTree}
      {rootFiles.map(file => fileRow(file))}
      {tree.map(node => folderNode(node))}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) operations.upload.mutate({ file, folder: uploadFolder });
          event.target.value = '';
        }}
      />
      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {renderMenu(menu.target)}
        </ContextMenu.Imperative>
      )}
      <RenameDialog
        open={!!renameTarget}
        currentName={
          renameTarget
            ? renameTarget.type === 'folder'
              ? renameTarget.path
              : renameTarget.file.name
            : ''
        }
        entityType={renameTarget ? entityTypeLabel(renameTarget.type) : 'diagram'}
        onRename={name => {
          const trimmed = name.trim();
          if (renameTarget && trimmed) {
            if (renameTarget.type === 'folder' && trimmed !== renameTarget.path)
              operations.renameFolder.mutate({ oldPath: renameTarget.path, newPath: trimmed });
            else if (renameTarget.type !== 'folder' && trimmed !== renameTarget.file.name)
              operations.renameFile.mutate({ file: renameTarget.file, newName: trimmed });
          }
          setRenameTarget(null);
        }}
        onCancel={() => setRenameTarget(null)}
      />
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title={deleteTarget ? deleteTitle(deleteTarget.type) : ''}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        detail="This can't be undone."
        confirmLabel={deleteTarget ? deleteConfirmLabel(deleteTarget.type) : ''}
        onConfirm={() => {
          if (deleteTarget?.type === 'folder') operations.deleteFolder.mutate(deleteTarget.path);
          else if (deleteTarget) operations.deleteFile.mutate(deleteTarget.file.path);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
});
