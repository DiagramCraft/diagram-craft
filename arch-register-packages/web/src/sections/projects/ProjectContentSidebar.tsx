import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import {
  TbBinaryTree2,
  TbCalendarWeek,
  TbCopy,
  TbColumns3,
  TbChartRadar,
  TbDownload,
  TbFileText,
  TbFolder,
  TbFolderOpen,
  TbHome,
  TbLayoutBoard,
  TbLayoutGrid,
  TbList,
  TbPencil,
  TbPlus,
  TbTrash,
  TbUpload
} from 'react-icons/tb';
import type { FileEntry } from '../../lib/api';
import {
  deleteConfirmLabel,
  deleteMessage,
  deleteTitle,
  entityTypeLabel,
  fileMenuTargetType,
  getFileNodeIcon,
  type MenuTarget
} from '../../lib/contentNode';
import {
  useCloneProjectFile,
  useCreateProjectMarkdown,
  useDeleteProjectFile,
  useDeleteProjectFolder,
  useMoveProjectFile,
  useRenameProjectBinaryFile,
  useRenameProjectFile,
  useRenameProjectFolder,
  useUploadProjectFile
} from '../../hooks/useProjectFiles';
import { useDeleteSavedView, useSavedViews, useUpdateSavedView } from '../../hooks/useEntities';
import { useProject, useProjectEntities } from '../../hooks/useProjects';
import { RenameDialog } from '../../components/RenameDialog';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { AddDiagramDialog } from './AddDiagramDialog';
import { AddFolderDialog } from './AddFolderDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import {
  asProjectPublicId,
  projectDetailRoute,
  projectDiagramRoute,
  projectMarkdownRoute
} from '../../routes/publicObjectRoutes';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { toSavedViewSearch } from '../entities/components/entityBrowserState';
import type { SavedView } from '@arch-register/api-types/viewContract';

type ProjectSection = 'home' | 'entities';
type ProjectSidebarTab = 'content' | 'views';

type FolderNode = {
  path: string;
  name: string;
  files: FileEntry[];
  children: FolderNode[];
};

const buildFolderTree = (
  folders: Array<{ path: string; name: string; files: FileEntry[] }>
): FolderNode[] => {
  const root: FolderNode[] = [];
  const map = new Map<string, FolderNode>();

  for (const folder of [...folders].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = folder.path.split('/');
    const node: FolderNode = {
      path: folder.path,
      name: folder.name,
      files: folder.files,
      children: []
    };
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

export const ProjectContentSidebar = ({
  workspaceSlug,
  projectId
}: {
  workspaceSlug: string;
  projectId: string;
}) => {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { diagramId?: string; nodeId?: string };
  const search = useSearch({ strict: false }) as {
    tab?: 'projects' | 'archive';
    folder?: string;
    section?: ProjectSection;
    dialog?: 'add-entity';
    viewId?: string;
  };
  const isEntitiesSection = search.section === 'entities';
  const section: ProjectSection = isEntitiesSection ? 'entities' : 'home';
  const folderFilter = search.folder ?? null;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;
  const isFileRoute = activeFileId !== null;

  const { data: project } = useProject(workspaceSlug, projectId);
  const { data: projectEntities = [] } = useProjectEntities(workspaceSlug, projectId);
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId
  });
  const deleteViewMutation = useDeleteSavedView(workspaceSlug);
  const updateViewMutation = useUpdateSavedView(workspaceSlug);
  const deleteFileMutation = useDeleteProjectFile(workspaceSlug, projectId);
  const deleteFolderMutation = useDeleteProjectFolder(workspaceSlug, projectId);
  const renameFolderMutation = useRenameProjectFolder(workspaceSlug, projectId);
  const cloneFileMutation = useCloneProjectFile(workspaceSlug, projectId);
  const renameFileMutation = useRenameProjectFile(workspaceSlug, projectId);
  const renameBinaryFileMutation = useRenameProjectBinaryFile(workspaceSlug, projectId);
  const moveFileMutation = useMoveProjectFile(workspaceSlug, projectId);
  const uploadFileMutation = useUploadProjectFile(workspaceSlug, projectId);
  const createMarkdownMutation = useCreateProjectMarkdown(workspaceSlug, projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<ProjectSidebarTab>(
    isEntitiesSection ? 'views' : 'content'
  );

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);
  const [renameTarget, setRenameTarget] = useState<MenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuTarget | null>(null);
  const [renameViewTarget, setRenameViewTarget] = useState<SavedView | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addFolderParent, setAddFolderParent] = useState<string | null>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addDiagramFolder, setAddDiagramFolder] = useState<string | null>(null);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addMarkdownFolder, setAddMarkdownFolder] = useState<string | null>(null);
  const folderTree = buildFolderTree(project?.files.folders ?? []);
  const projectViews = savedViews.filter(view => view.scope === 'project');

  useEffect(() => {
    setSidebarTab(isEntitiesSection ? 'views' : 'content');
  }, [isEntitiesSection]);

  const navigateToProject = (next: { section?: ProjectSection; folder?: string }) => {
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        section: next.section ?? section,
        folder: next.folder,
        dialog: search.dialog
      })
    );
  };

  const getViewIcon = (mode: SavedView['viewMode']) => {
    switch (mode) {
      case 'table':
        return <TbList size={12} />;
      case 'cards':
        return <TbLayoutGrid size={12} />;
      case 'tree':
        return <TbBinaryTree2 size={12} />;
      case 'radar':
        return <TbChartRadar size={12} />;
      case 'timeline':
        return <TbCalendarWeek size={12} />;
      case 'hierarchy':
        return <TbLayoutBoard size={12} />;
      case 'explore':
        return <TbColumns3 size={12} />;
      default:
        return <TbHome size={12} />;
    }
  };

  const applySavedView = (view: SavedView) => {
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        section: 'entities',
        folder: undefined,
        dialog: undefined,
        ...toSavedViewSearch(view)
      })
    );
  };

  const openAddEntity = () => {
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        tab: search.tab,
        section: 'entities',
        folder: folderFilter ?? undefined,
        dialog: 'add-entity'
      })
    );
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !(prev[path] ?? true) }));
  };

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
    const allFolders =
      project?.files.folders.map(folder => folder.path).filter(path => path !== currentFolder) ?? [];

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
            {renderMoveToSubmenu(target.file, allFolders, currentFolder)}
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
          {renderMoveToSubmenu(target.file, allFolders, currentFolder)}
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

  const triggerDownload = (file: FileEntry) => {
    const a = document.createElement('a');
    a.href = `/api/${workspaceSlug}/projects/${projectId}/files/download?path=${encodeURIComponent(file.path)}`;
    a.download = file.original_filename ?? file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate({ file, folder: uploadFolder });
    }
    e.target.value = '';
  };

  const openUploadPicker = (folder: string | null) => {
    setUploadFolder(folder);
    fileInputRef.current?.click();
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
    const isExpanded = expandedFolders[node.path] ?? true;
    return (
      <div key={node.path}>
        <TreeRow
          icon={<TbFolder size={13} />}
          label={node.name}
          expandable
          expanded={isExpanded}
          active={section === 'home' && folderFilter === node.path}
          depth={depth}
          onExpand={() => toggleFolder(node.path)}
          onClick={() => navigateToProject({ section: 'home', folder: node.path })}
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
                            ? projectMarkdownRoute(
                                workspaceSlug,
                                asProjectPublicId(projectId),
                                file.id
                              )
                            : projectDiagramRoute(
                                workspaceSlug,
                                asProjectPublicId(projectId),
                                file.id
                              )
                        )
                }
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    target: {
                      type: fileMenuTargetType(file.type),
                      file
                    }
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
      <SidebarHeader
        actions={
          sidebarTab === 'content' ? (
            <MenuButton.Root>
              <MenuButton.Trigger element={
                <button type="button" className={styles.action} title="Add">
                  <TbPlus size={13} />
                </button>
              } />
              <MenuButton.Menu>
                <Menu.Item
                  leftSlot={<TbFolderOpen size={13} />}
                  disabled={!project?.canManageFiles}
                  onClick={() => {
                    setAddFolderParent(section === 'home' ? folderFilter : null);
                    setAddFolderOpen(true);
                  }}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbPlus size={13} />}
                  disabled={!project?.canManageFiles}
                  onClick={() => {
                    setAddDiagramFolder(section === 'home' ? folderFilter : null);
                    setAddDiagramOpen(true);
                  }}
                >
                  New diagram
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbUpload size={13} />}
                  disabled={!project?.canManageFiles}
                  onClick={() => openUploadPicker(section === 'home' ? folderFilter : null)}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbFileText size={13} />}
                  disabled={!project?.canManageFiles}
                  onClick={() => {
                    setAddMarkdownFolder(section === 'home' ? folderFilter : null);
                    setAddMarkdownOpen(true);
                  }}
                >
                  New wiki page
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbBinaryTree2 size={13} />}
                  disabled={!project?.canEdit}
                  onClick={openAddEntity}
                >
                  Add entity
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : null
        }
      >
        <Tabs.Root value={sidebarTab} onValueChange={value => setSidebarTab(value as ProjectSidebarTab)}>
          <Tabs.List>
            <Tabs.Trigger value="content">Content</Tabs.Trigger>
            <Tabs.Trigger value="views">Views</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      <div className={styles.scroll}>
        {sidebarTab === 'content' ? (
          <>
            <TreeRow
              testId="project-secondary-home"
              label="Home"
              icon={<TbHome size={13} />}
              active={section === 'home' && !folderFilter && !isFileRoute}
              onClick={() => navigateToProject({ section: 'home', folder: undefined })}
            />
            <TreeRow
              testId="project-secondary-entities"
              label={`Entities (${projectEntities.length})`}
              icon={<TbBinaryTree2 size={13} />}
              active={isEntitiesSection}
              onClick={() =>
                navigateToProject({ section: 'entities', folder: folderFilter ?? undefined })
              }
            />
            {project?.files.rootFiles.map(file => (
              <TreeRow
                key={file.id}
                icon={getFileNodeIcon(file.type)}
                label={file.original_filename ?? file.name}
                active={file.id === activeFileId}
                onClick={
                  file.type === 'file'
                    ? undefined
                    : () =>
                        navigate(
                          file.type === 'markdown'
                            ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
                            : projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
                        )
                }
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    target: {
                      type: fileMenuTargetType(file.type),
                      file
                    }
                  });
                }}
              />
            ))}
            {folderTree.map(node => renderFolderNode(node))}
          </>
        ) : (
          <>
            {projectViews.length > 0 && (
              <>
                <SidebarGroupLabel>Views</SidebarGroupLabel>
                {projectViews.map(view => (
                  <TreeRow
                    key={view.id}
                    icon={getViewIcon(view.viewMode)}
                    label={view.name}
                    active={search.viewId === view.id}
                    onClick={() => applySavedView(view)}
                    onContextMenu={e => {
                      if (!project?.canEdit) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setViewMenu({ x: e.clientX, y: e.clientY, view });
                    }}
                  />
                ))}
              </>
            )}
            {savedViews.length === 0 && (
              <div className={`${styles.emptyState} dim`}>No saved views yet.</div>
            )}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {renderMenu(menu.target)}
        </ContextMenu.Imperative>
      )}

      {viewMenu && (
        <ContextMenu.Imperative x={viewMenu.x} y={viewMenu.y} onClose={() => setViewMenu(null)}>
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            onClick={() => setRenameViewTarget(viewMenu.view)}
          >
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteViewTarget(viewMenu.view)}
          >
            Delete
          </Menu.Item>
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

      <DeleteConfirmationDialog
        open={!!deleteViewTarget}
        title="Delete view?"
        message={
          <>
            The view <b>{deleteViewTarget?.name}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete view"
        onConfirm={() => {
          if (deleteViewTarget) {
            deleteViewMutation.mutate(deleteViewTarget.id);
            setDeleteViewTarget(null);
          }
        }}
        onCancel={() => setDeleteViewTarget(null)}
      />

      {renameViewTarget && (
        <RenameDialog
          open={true}
          currentName={renameViewTarget.name}
          entityType="view"
          onRename={newName => {
            updateViewMutation.mutate({ id: renameViewTarget.id, body: { name: newName } });
            setRenameViewTarget(null);
          }}
          onCancel={() => setRenameViewTarget(null)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {project?.canManageFiles && (
        <AddFolderDialog
          open={addFolderOpen}
          onClose={() => {
            setAddFolderOpen(false);
            setAddFolderParent(null);
          }}
          onCreated={() => {}}
          workspaceId={workspaceSlug}
          projectId={projectId}
          parentFolder={addFolderParent ?? undefined}
        />
      )}

      {project?.canManageFiles && (
        <AddDiagramDialog
          open={addDiagramOpen}
          onClose={() => {
            setAddDiagramOpen(false);
            setAddDiagramFolder(null);
          }}
          onCreated={() => {}}
          workspaceId={workspaceSlug}
          context="project"
          projectId={projectId}
          projectName={project?.name ?? 'Project'}
          folder={addDiagramFolder}
        />
      )}

      {project?.canManageFiles && (
        <AddMarkdownDialog
          open={addMarkdownOpen}
          onClose={() => { setAddMarkdownOpen(false); setAddMarkdownFolder(null); }}
          onCreated={file => {
            setAddMarkdownOpen(false);
            setAddMarkdownFolder(null);
            navigate(projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id));
          }}
          onCreate={name => createMarkdownMutation.mutateAsync({ name, folder: addMarkdownFolder ?? undefined })}
          isPending={createMarkdownMutation.isPending}
        />
      )}
    </>
  );
};
