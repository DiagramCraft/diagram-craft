import { useRef, useState } from 'react';
import {
  TbCopy,
  TbDownload,
  TbFileText,
  TbFolder,
  TbFolderOpen,
  TbHome,
  TbPencil,
  TbPlus,
  TbTrash,
  TbUpload
} from 'react-icons/tb';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  fileMenuTargetType,
  getFileNodeIcon,
  type MenuTarget
} from '../../lib/contentNode';
import type { FileEntry } from '../../lib/api';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import {
  useWorkspaceContentNodes,
  useCreateWorkspaceFolder,
  useCreateWorkspaceMarkdown,
  useUploadWorkspaceFile,
  useDeleteWorkspaceFile,
  useDeleteWorkspaceFolder,
  useRenameWorkspaceFolder,
  useCloneWorkspaceFile,
  useRenameWorkspaceFile,
  useRenameWorkspaceBinaryFile,
  useMoveWorkspaceFile
} from '../../hooks/useProjectFiles';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { RenameDialog } from '../../components/RenameDialog';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';

export const WorkspaceContentSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { data } = useWorkspaceContentNodes(workspaceSlug);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [renameTarget, setRenameTarget] = useState<MenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuTarget | null>(null);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addFolderParent, setAddFolderParent] = useState<string | null>(null);
  const [addDiagramFolder, setAddDiagramFolder] = useState<string | null>(null);
  const [addMarkdownFolder, setAddMarkdownFolder] = useState<string | null>(null);
  const createFolderMutation = useCreateWorkspaceFolder(workspaceSlug);
  const createMarkdownMutation = useCreateWorkspaceMarkdown(workspaceSlug);
  const uploadFileMutation = useUploadWorkspaceFile(workspaceSlug);
  const deleteFileMutation = useDeleteWorkspaceFile(workspaceSlug);
  const deleteFolderMutation = useDeleteWorkspaceFolder(workspaceSlug);
  const renameFolderMutation = useRenameWorkspaceFolder(workspaceSlug);
  const cloneFileMutation = useCloneWorkspaceFile(workspaceSlug);
  const renameFileMutation = useRenameWorkspaceFile(workspaceSlug);
  const renameBinaryFileMutation = useRenameWorkspaceBinaryFile(workspaceSlug);
  const moveFileMutation = useMoveWorkspaceFile(workspaceSlug);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { diagramId?: string; nodeId?: string };
  const search = useSearch({ strict: false }) as {
    contentFolder?: string;
    contentQuery?: string;
    contentView?: 'grid' | 'list';
  };
  const contentFolder = search.contentFolder;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;
  const isFileRoute = activeFileId !== null;

  const triggerDownload = (file: FileEntry) => {
    const a = document.createElement('a');
    a.href = `/api/${workspaceSlug}/content/files/download?path=${encodeURIComponent(file.path)}`;
    a.download = file.original_filename ?? file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      uploadFileMutation.mutate({ file: f, folder: uploadFolder });
    }
    e.target.value = '';
  };

  const openUploadPicker = (folder: string | null) => {
    setUploadFolder(folder);
    fileInputRef.current?.click();
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  type FolderNode = {
    path: string;
    name: string;
    files: FileEntry[];
    children: FolderNode[];
  };

  const buildFolderTree = (
    folders: Array<{
      path: string;
      name: string;
      files: FileEntry[];
    }>
  ): FolderNode[] => {
    const root: FolderNode[] = [];
    const map = new Map<string, FolderNode>();
    const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));
    for (const folder of sorted) {
      const parts = folder.path.split('/');
      const node: FolderNode = { path: folder.path, name: folder.name, files: folder.files, children: [] };
      map.set(folder.path, node);
      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          root.push(node);
        }
      }
    }
    return root;
  };

  const folderTree = data ? buildFolderTree(data.folders as unknown as Array<{ path: string; name: string; files: FileEntry[] }>) : [];
  const activeFilePath = data
    ? [...data.rootFiles, ...data.folders.flatMap(folder => folder.files)].find(file => file.id === activeFileId)?.path ?? null
    : null;

  const allFolderPaths = data?.folders.map(f => f.path) ?? [];

  const renderMoveToSubmenu = (file: FileEntry, folders: string[], currentFolder: string | null) => {
    type MoveFolderNode = {
      path: string;
      name: string;
      children: MoveFolderNode[];
    };

    const root: MoveFolderNode[] = [];
    const map = new Map<string, MoveFolderNode>();
    for (const path of [...folders].sort()) {
      const name = path.split('/').at(-1) ?? path;
      const node: MoveFolderNode = { path, name, children: [] };
      map.set(path, node);
      const parts = path.split('/');
      if (parts.length === 1) {
        root.push(node);
      } else {
        map.get(parts.slice(0, -1).join('/'))?.children.push(node);
      }
    }

    const renderNodes = (nodes: MoveFolderNode[]): React.ReactNode =>
      nodes.map(node =>
        node.children.length > 0 ? (
          <Menu.SubMenu key={node.path} label={node.name} leftSlot={<TbFolder size={13} />}>
            <Menu.Item
              leftSlot={<TbFolder size={13} />}
              disabled={node.path === currentFolder}
              onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
            >
              {node.name}
            </Menu.Item>
            {renderNodes(node.children)}
          </Menu.SubMenu>
        ) : (
          <Menu.Item
            key={node.path}
            leftSlot={<TbFolder size={13} />}
            disabled={node.path === currentFolder}
            onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
          >
            {node.name}
          </Menu.Item>
        )
      );

    return (
      <>
        <Menu.Item
          leftSlot={<TbFolderOpen size={13} />}
          disabled={currentFolder === null}
          onClick={() => moveFileMutation.mutate({ file, targetFolder: null })}
        >
          Root
        </Menu.Item>
        {renderNodes(root)}
      </>
    );
  };

  const renderMenu = (target: MenuTarget) => {
    if (target.type === 'folder') {
      return (
        <>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => {
              setMenu(null);
              setAddDiagramFolder(target.path);
              setAddDiagramOpen(true);
            }}
          >
            New diagram
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => {
              setMenu(null);
              setAddFolderParent(target.path);
              setAddFolderOpen(true);
            }}
          >
            New folder
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbUpload size={13} />}
            onClick={() => {
              setMenu(null);
              openUploadPicker(target.path);
            }}
          >
            Upload file
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFileText size={13} />}
            onClick={() => {
              setMenu(null);
              setAddMarkdownFolder(target.path);
              setAddMarkdownOpen(true);
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
    }

    const currentFolder = target.file.path.includes('/')
      ? target.file.path.substring(0, target.file.path.lastIndexOf('/'))
      : null;
    const folders = allFolderPaths.filter(path => path !== currentFolder);

    if (target.type === 'file') {
      return (
        <>
          <Menu.Item
            leftSlot={<TbDownload size={13} />}
            onClick={() => {
              setMenu(null);
              triggerDownload(target.file);
            }}
          >
            Download
          </Menu.Item>
          <Menu.Separator />
          <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
            {renderMoveToSubmenu(target.file, folders, currentFolder)}
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
    }

    return (
      <>
        {target.type === 'diagram' && (
          <Menu.Item
            leftSlot={<TbCopy size={13} />}
            onClick={() => cloneFileMutation.mutate(target.file)}
          >
            Clone
          </Menu.Item>
        )}
        {target.type === 'diagram' && <Menu.Separator />}
        <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
          {renderMoveToSubmenu(target.file, folders, currentFolder)}
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

  const handleRenameConfirm = (newName: string) => {
    if (!renameTarget) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameTarget(null);
      return;
    }
    if (renameTarget.type === 'file') {
      if (trimmed !== renameTarget.file.name) {
        renameBinaryFileMutation.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else if (renameTarget.type !== 'folder') {
      if (trimmed !== renameTarget.file.name) {
        renameFileMutation.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else if (trimmed !== renameTarget.path) {
      renameFolderMutation.mutate({ oldPath: renameTarget.path, newPath: trimmed });
    }
    setRenameTarget(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type !== 'folder') {
      deleteFileMutation.mutate(deleteTarget.file.path);
    } else {
      deleteFolderMutation.mutate(deleteTarget.path);
    }
    setDeleteTarget(null);
  };

  const renderFolderNode = (node: FolderNode, depth = 0): React.ReactNode => {
    const isExpanded =
      expandedFolders.has(node.path) ||
      activeFilePath?.startsWith(`${node.path}/`);
    return (
      <div key={node.path}>
        <TreeRow
          icon={<TbFolder size={13} />}
          label={node.name}
          expandable
          expanded={isExpanded}
          active={contentFolder === node.path}
          depth={depth}
          onExpand={() => toggleFolder(node.path)}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/content',
              params: { workspaceSlug },
              search: {
                contentFolder: node.path,
                contentQuery: search.contentQuery,
                contentView: search.contentView
              }
            })
          }
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, target: { type: 'folder', path: node.path } });
          }}
        />
        {isExpanded && (
          <>
            {node.files.map(file => (
              <TreeRow
                key={file.id}
                depth={depth + 1}
                icon={getFileNodeIcon(file.type)}
                label={file.original_filename ?? file.name}
                active={file.id === activeFileId}
                onClick={
                  file.type === 'file'
                    ? () => triggerDownload(file)
                    : () =>
                        navigate(
                          file.type === 'markdown'
                            ? {
                                to: '/$workspaceSlug/content/wiki/$nodeId',
                                params: { workspaceSlug, nodeId: file.id }
                              }
                            : {
                                to: '/$workspaceSlug/content/diagrams/$diagramId',
                                params: { workspaceSlug, diagramId: file.id }
                              }
                        )
                }
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    target: { type: fileMenuTargetType(file.type), file }
                  });
                }}
              />
            ))}
            {node.children.map(child => renderFolderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root value="content" onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Trigger value="content">Content</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <div className={styles.headerActions}>
          <MenuButton.Root>
            <MenuButton.Trigger element={
              <button type="button" className={styles.action} title="New">
                <TbPlus size={13} />
              </button>
            } />
            <MenuButton.Menu>
              <Menu.Item
                leftSlot={<TbFolderOpen size={13} />}
                onClick={() => setAddFolderOpen(true)}
              >
                New folder
              </Menu.Item>
              <Menu.Item
                leftSlot={<TbUpload size={13} />}
                onClick={() => openUploadPicker(contentFolder ?? null)}
              >
                Upload file
              </Menu.Item>
              <Menu.Item
                leftSlot={<TbPlus size={13} />}
                onClick={() => setAddDiagramOpen(true)}
              >
                New diagram
              </Menu.Item>
              <Menu.Item
                leftSlot={<TbFileText size={13} />}
                onClick={() => setAddMarkdownOpen(true)}
              >
                New wiki page
              </Menu.Item>
            </MenuButton.Menu>
          </MenuButton.Root>
        </div>
      </div>
      <div className={styles.scroll}>
        <TreeRow
          label="Home"
          icon={<TbHome size={13} />}
          active={!contentFolder && !isFileRoute}
          onClick={() =>
            navigate({
              to: '/$workspaceSlug/content',
              params: { workspaceSlug },
              search: {
                contentFolder: undefined,
                contentQuery: search.contentQuery,
                contentView: search.contentView
              }
            })
          }
        />
        {data?.rootFiles.map(file => (
          <TreeRow
            key={file.id}
            icon={getFileNodeIcon(file.type)}
            label={(file as unknown as FileEntry).original_filename ?? file.name}
            active={file.id === activeFileId}
            onClick={
              file.type === 'file'
                ? () => triggerDownload(file as unknown as FileEntry)
                : () =>
                    navigate(
                      file.type === 'markdown'
                        ? {
                            to: '/$workspaceSlug/content/wiki/$nodeId',
                            params: { workspaceSlug, nodeId: file.id }
                          }
                        : {
                            to: '/$workspaceSlug/content/diagrams/$diagramId',
                            params: { workspaceSlug, diagramId: file.id }
                          }
                    )
            }
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({
                x: e.clientX,
                y: e.clientY,
                target: { type: fileMenuTargetType(file.type), file: file as unknown as FileEntry }
              });
            }}
          />
        ))}
        {folderTree.map(node => renderFolderNode(node, 0))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
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
            ? renameTarget.type !== 'folder'
              ? renameTarget.file.name
              : renameTarget.path
            : ''
        }
        entityType={renameTarget ? entityTypeLabel(renameTarget.type) : 'diagram'}
        onRename={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        title={deleteTarget ? deleteTitle(deleteTarget.type) : ''}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        detail="This can't be undone."
        confirmLabel={deleteTarget ? deleteConfirmLabel(deleteTarget.type) : ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ContentFolderDialog
        open={addFolderOpen}
        onClose={() => {
          setAddFolderOpen(false);
          setAddFolderParent(null);
        }}
        onCreated={() => {
          setAddFolderOpen(false);
          setAddFolderParent(null);
        }}
        onSubmit={path => createFolderMutation.mutateAsync(path)}
        isPending={createFolderMutation.isPending}
        parentFolder={addFolderParent ?? contentFolder}
        placeholder="e.g. Architecture"
      />

      <AddDiagramDialog
        open={addDiagramOpen}
        onClose={() => {
          setAddDiagramOpen(false);
          setAddDiagramFolder(null);
        }}
        onCreated={file => {
          setAddDiagramOpen(false);
          setAddDiagramFolder(null);
          navigate({
            to: '/$workspaceSlug/content/diagrams/$diagramId',
            params: { workspaceSlug, diagramId: file.id }
          });
        }}
        workspaceId={workspaceSlug}
        context="workspace"
        folder={addDiagramFolder ?? contentFolder ?? null}
      />

      <AddMarkdownDialog
        open={addMarkdownOpen}
        onClose={() => { setAddMarkdownOpen(false); setAddMarkdownFolder(null); }}
        onCreated={file => {
          setAddMarkdownOpen(false);
          setAddMarkdownFolder(null);
          navigate({
            to: '/$workspaceSlug/content/wiki/$nodeId',
            params: { workspaceSlug, nodeId: file.id },
            search: { mode: 'edit' }
          });
        }}
        onCreate={name => createMarkdownMutation.mutateAsync({ name, folder: addMarkdownFolder ?? contentFolder ?? null })}
        isPending={createMarkdownMutation.isPending}
      />
    </>
  );
};
