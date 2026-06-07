import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useMatches, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from './SidePanel.module.css';
import { TreeRow } from '../components/TreeRow';
import { TypeBadge } from '../components/TypeBadge';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  TbFolders,
  TbDatabase,
  TbUsers,
  TbFolderOpen,
  TbSettings,
  TbTrash,
  TbTag,
  TbHistory,
  TbShieldLock,
  TbPlus,
  TbPencil,
  TbCopy,
  TbFolder,
  TbSparkles,
  TbTable,
  TbVectorTriangle,
  TbChartRadar,
  TbLayoutGrid,
  TbList,
  TbBinaryTree2
} from 'react-icons/tb';
import { fetchEntityFacets, resolveSchemaColor } from '../api';
import type { FileEntry } from '../api';
import {
  useProjectFiles,
  useDeleteProjectFile,
  useDeleteProjectFolder,
  useRenameProjectFolder,
  useCloneProjectFile,
  useRenameProjectFile,
  useMoveProjectFile
} from '../hooks/useProjectFiles';
import { useSavedViews, useDeleteSavedView, useUpdateSavedView } from '../hooks/useEntities';
import type {
  EntityFacets,
  EntitySchema,
  Project,
  WorkspaceEnum,
  WorkspaceLifecycleState,
  SavedView
} from '../api';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { deriveActiveView } from '../layouts/deriveActiveView';
import { AddDiagramDialog } from '../dialogs/AddDiagramDialog';
import { AddFolderDialog } from '../dialogs/AddFolderDialog';
import { GlobalSettingsSidebar } from './GlobalSettingsSidebar';
import { AccountSettingsSidebar } from './AccountSettingsSidebar';

const PROJECT_GROUPS = [
  { status: 'pinned', title: 'Pinned Projects' },
  { status: 'active', title: 'Active Projects' }
] as const;

const ARCHIVED_PROJECT_GROUP = { status: 'archived', title: 'Archived Projects' } as const;

type ProjectSidebarTab = 'projects' | 'archive';

export const SidePanel = () => {
  const matches = useMatches();
  const view = deriveActiveView(matches);
  const ctx = useWorkspaceContext();

  let body: React.ReactNode;

  if (view === 'home') {
    body = (
      <HomeSidebar
        schemas={ctx.schemas}
        projects={ctx.projects}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'project-detail') {
    body = <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />;
  } else if (view === 'entity-browser' || view === 'entity-detail') {
    body = (
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'data-model') {
    body = (
      <DataModelSidebar schemas={ctx.schemas} enums={ctx.enums} workspaceSlug={ctx.workspaceSlug} />
    );
  } else if (view === 'search') {
    body = <SearchSidebar />;
  } else if (view === 'workspace-settings') {
    body = (
      <SettingsSidebar
        workspaceSlug={ctx.workspaceSlug}
        workspace={ctx.workspace}
        schemas={ctx.schemas}
        projects={ctx.projects}
        availableSections={ctx.availableSettingsSections}
      />
    );
  } else if (view === 'global-settings') {
    body = <GlobalSettingsSidebar />;
  } else if (view === 'account-settings') {
    body = <AccountSettingsSidebar />;
  }

  return <div className={styles.panel}>{body}</div>;
};

const SectionHeader = ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <Tabs.Root value="section">
      <Tabs.List>
        <Tabs.Trigger value="section">{title}</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

const getSidebarProjectGroups = (projects: Project[]) =>
  PROJECT_GROUPS.map(group => ({
    ...group,
    projects: projects.filter(project => project.status === group.status)
  })).filter(group => group.projects.length > 0);

const getArchivedProjectGroup = (projects: Project[]) => ({
  ...ARCHIVED_PROJECT_GROUP,
  projects: projects.filter(project => project.status === ARCHIVED_PROJECT_GROUP.status)
});

const HomeSidebar = ({
  schemas,
  projects,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  projects: Project[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  return (
    <>
      <SectionHeader title="Overview" />
      <div className={styles.scroll}>
        {getSidebarProjectGroups(projects).map(group => (
          <div key={group.status}>
            <GroupLabel>{group.title}</GroupLabel>
            {group.projects.map(p => (
              <TreeRow
                key={p.id}
                icon={<TbFolders size={12} style={p.color ? { color: p.color } : undefined} />}
                label={p.name}
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/projects/$projectId',
                    params: { workspaceSlug, projectId: p.id },
                    search: {
                      tab: p.status === 'archived' ? ('archive' as const) : ('projects' as const)
                    }
                  })
                }
                trailing={<span className="dim mono">{p.file_count}</span>}
                tagColor={p.color ?? undefined}
              />
            ))}
          </div>
        ))}
        <GroupLabel>Data model</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={
              <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />
            }
            label={s.name}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
                search: { type: s.id }
              })
            }
            trailing={<span className="dim mono">{s.entity_count}</span>}
            tagColor={resolveSchemaColor(s, i)}
          />
        ))}
      </div>
    </>
  );
};

const SidebarRenameDialog = ({
  open,
  currentName,
  entityType,
  onRename,
  onCancel
}: {
  open: boolean;
  currentName: string;
  entityType: 'diagram' | 'folder' | 'view';
  onRename: (newName: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      }, 0);
    }
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onRename(trimmed);
  };

  return (
    <Dialog open={open} onClose={onCancel} title={`Rename ${entityType}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--base-fg-more-dim)' }}>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              fontSize: 13,
              padding: '6px 8px',
              background: 'var(--base-bg)',
              border: '1px solid var(--cmp-border)',
              borderRadius: 'var(--r)',
              color: 'var(--base-fg)',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className={styles.renameBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.renameBtnPrimary} disabled={!name.trim()}>
            Rename
          </button>
        </div>
      </form>
    </Dialog>
  );
};

type SidebarMenuTarget =
  | { type: 'diagram'; file: FileEntry; projectId: string }
  | { type: 'folder'; path: string; projectId: string }
  | { type: 'project'; projectId: string };

const ProjectsSidebar = ({
  projects,
  workspaceSlug
}: {
  projects: Project[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: string; folder?: string };
  const matches = useMatches();
  const allParams = Object.assign({}, ...matches.map(m => m.params)) as Record<string, string>;
  const projectId = allParams.projectId ?? null;
  const projectSidebarTab: ProjectSidebarTab = search.tab === 'archive' ? 'archive' : 'projects';
  const folderFilter = search.folder ?? null;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectedProject = projects.find(project => project.id === projectId) ?? null;

  const { data: fileTree = null } = useProjectFiles(workspaceSlug, projectId ?? '');

  // Context menu state
  const [menu, setMenu] = useState<{ x: number; y: number; target: SidebarMenuTarget } | null>(
    null
  );
  const [renameTarget, setRenameTarget] = useState<SidebarMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SidebarMenuTarget | null>(null);
  const [addDiagramState, setAddDiagramState] = useState<{
    projectId: string;
    folder: string | null;
  } | null>(null);
  const [addFolderState, setAddFolderState] = useState<{
    projectId: string;
    parent: string | null;
  } | null>(null);

  // Mutation hooks for the selected project
  const deleteFileMutation = useDeleteProjectFile(workspaceSlug, projectId ?? '');
  const deleteFolderMutation = useDeleteProjectFolder(workspaceSlug, projectId ?? '');
  const renameFolderMutation = useRenameProjectFolder(workspaceSlug, projectId ?? '');
  const cloneFileMutation = useCloneProjectFile(workspaceSlug, projectId ?? '');
  const renameFileMutation = useRenameProjectFile(workspaceSlug, projectId ?? '');
  const moveFileMutation = useMoveProjectFile(workspaceSlug, projectId ?? '');

  const openMenu = (e: React.MouseEvent, target: SidebarMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  type FolderNode = {
    path: string;
    name: string;
    children: FolderNode[];
  };

  const buildFolderTree = (folders: string[]): FolderNode[] => {
    const root: FolderNode[] = [];
    const map = new Map<string, FolderNode>();

    const sorted = [...folders].sort();

    for (const path of sorted) {
      const parts = path.split('/');
      const name = parts[parts.length - 1] ?? path;
      const node: FolderNode = { path, name, children: [] };
      map.set(path, node);

      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    return root;
  };

  const renderMoveToSubmenu = (
    file: FileEntry,
    folders: string[],
    currentFolder: string | null
  ) => {
    const folderTree = buildFolderTree(folders);

    const renderFolderNodes = (nodes: FolderNode[]): React.ReactNode => {
      return nodes.map(node => {
        const isCurrentFolder = node.path === currentFolder;
        if (node.children.length > 0) {
          return (
            <Menu.SubMenu key={node.path} label={node.name} leftSlot={<TbFolder size={13} />}>
              <Menu.Item
                leftSlot={<TbFolder size={13} />}
                disabled={isCurrentFolder}
                onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
              >
                {node.name}
              </Menu.Item>
              {renderFolderNodes(node.children)}
            </Menu.SubMenu>
          );
        }
        return (
          <Menu.Item
            key={node.path}
            leftSlot={<TbFolder size={13} />}
            disabled={isCurrentFolder}
            onClick={() => moveFileMutation.mutate({ file, targetFolder: node.path })}
          >
            {node.name}
          </Menu.Item>
        );
      });
    };

    return (
      <>
        <Menu.Item
          leftSlot={<TbFolderOpen size={13} />}
          disabled={currentFolder === null}
          onClick={() => moveFileMutation.mutate({ file, targetFolder: null })}
        >
          Root
        </Menu.Item>
        {folderTree.length > 0 && renderFolderNodes(folderTree)}
      </>
    );
  };

  const renderMenu = (target: SidebarMenuTarget) => {
    if (target.type === 'project') {
      return (
        <>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => setAddDiagramState({ projectId: target.projectId, folder: null })}
          >
            New diagram
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => setAddFolderState({ projectId: target.projectId, parent: null })}
          >
            New folder
          </Menu.Item>
        </>
      );
    }
    if (target.type === 'folder') {
      return (
        <>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => setAddDiagramState({ projectId: target.projectId, folder: target.path })}
          >
            New diagram
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbFolderOpen size={13} />}
            onClick={() => setAddFolderState({ projectId: target.projectId, parent: target.path })}
          >
            New folder
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
    // diagram
    const allFolders = (fileTree?.folders ?? []).map(f => f.path);
    const currentFolder = target.file.path.includes('/')
      ? target.file.path.substring(0, target.file.path.lastIndexOf('/'))
      : null;

    return (
      <>
        <Menu.Item
          leftSlot={<TbCopy size={13} />}
          onClick={() => cloneFileMutation.mutate(target.file)}
        >
          Clone
        </Menu.Item>
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

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'diagram') {
      deleteFileMutation.mutate(deleteTarget.file.path);
    } else if (deleteTarget.type === 'folder') {
      deleteFolderMutation.mutate(deleteTarget.path);
    }
    setDeleteTarget(null);
  };

  const handleRenameConfirm = (newName: string) => {
    if (!renameTarget) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameTarget(null);
      return;
    }
    if (renameTarget.type === 'diagram') {
      if (trimmed !== renameTarget.file.name) {
        renameFileMutation.mutate({ file: renameTarget.file, newName: trimmed });
      }
    } else if (renameTarget.type === 'folder') {
      if (trimmed !== renameTarget.path) {
        renameFolderMutation.mutate({ oldPath: renameTarget.path, newPath: trimmed });
      }
    }
    setRenameTarget(null);
  };

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const projectGroups =
    projectSidebarTab === 'archive'
      ? [getArchivedProjectGroup(projects)].filter(group => group.projects.length > 0)
      : getSidebarProjectGroups(projects);

  useEffect(() => {
    if (!selectedProject) return;
    const nextTab = selectedProject.status === 'archived' ? 'archive' : 'projects';
    if (nextTab !== projectSidebarTab) {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: { tab: nextTab as 'projects' | 'archive', folder: folderFilter ?? undefined }
      });
    }
  }, [selectedProject, projectSidebarTab, navigate, workspaceSlug, folderFilter]);

  const navigateToProject = (project: Project, folder?: string | null) => {
    navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug, projectId: project.id },
      search: {
        tab: (project.status === 'archived' ? 'archive' : 'projects') as 'projects' | 'archive',
        folder: folder ?? undefined
      }
    });
  };

  const activateTab = (tab: ProjectSidebarTab) => {
    const targetProjects =
      tab === 'archive'
        ? projects.filter(project => project.status === 'archived')
        : projects.filter(project => project.status !== 'archived');

    if (!selectedProject || !targetProjects.some(project => project.id === selectedProject.id)) {
      const target = targetProjects[0];
      if (target) {
        navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug, projectId: target.id },
          search: { tab }
        });
      }
    } else {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: { tab }
      });
    }
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root
          value={projectSidebarTab}
          onValueChange={value => activateTab(value as 'projects' | 'archive')}
        >
          <Tabs.List>
            <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
            <Tabs.Trigger value="archive">Archive</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      <div className={styles.scroll}>
        {projectGroups.length > 0 ? (
          projectGroups.map(group => (
            <div key={group.status}>
              <GroupLabel>{group.title}</GroupLabel>
              {group.projects.map(p => {
                const isSelected = p.id === projectId;
                const isOpen = expanded[p.id] ?? isSelected;
                const tree = isSelected ? fileTree : null;

                return (
                  <div key={p.id}>
                    <TreeRow
                      expandable
                      expanded={isOpen}
                      onExpand={() => toggle(p.id)}
                      icon={
                        <TbFolders size={12} style={p.color ? { color: p.color } : undefined} />
                      }
                      label={p.name}
                      active={isSelected && !folderFilter}
                      onClick={() => navigateToProject(p)}
                      onContextMenu={e => openMenu(e, { type: 'project', projectId: p.id })}
                      trailing={<span className="dim mono">{p.file_count}</span>}
                      tagColor={p.color ?? undefined}
                    />
                    {isOpen &&
                      tree &&
                      tree.folders.map(folder => {
                        const folderKey = `${p.id}:${folder.path}`;
                        const folderOpen = expanded[folderKey] ?? true;
                        return (
                          <div key={folder.path}>
                            <TreeRow
                              depth={1}
                              expandable
                              expanded={folderOpen}
                              onExpand={() => toggle(folderKey)}
                              icon={<TbFolderOpen size={12} />}
                              label={folder.path}
                              active={isSelected && folderFilter === folder.path}
                              onClick={() => navigateToProject(p, folder.path)}
                              onContextMenu={e =>
                                openMenu(e, { type: 'folder', path: folder.path, projectId: p.id })
                              }
                            />
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className={`${styles.emptyState} dim`}>
            {projectSidebarTab === 'archive' ? 'No archived projects.' : 'No projects.'}
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu.Imperative x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {renderMenu(menu.target)}
        </ContextMenu.Imperative>
      )}

      {renameTarget && renameTarget.type !== 'project' && (
        <SidebarRenameDialog
          open={true}
          currentName={renameTarget.type === 'diagram' ? renameTarget.file.name : renameTarget.path}
          entityType={renameTarget.type}
          onRename={handleRenameConfirm}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={!!deleteTarget && deleteTarget.type !== 'project'}
        title={deleteTarget?.type === 'folder' ? 'Delete folder?' : 'Delete diagram?'}
        message={
          deleteTarget ? (
            deleteTarget.type === 'folder' ? (
              <>
                The folder <b>{deleteTarget.path}</b> and all diagrams inside it will be permanently
                deleted.
              </>
            ) : deleteTarget.type === 'diagram' ? (
              <>
                The diagram <b>{deleteTarget.file.name}</b> will be permanently deleted.
              </>
            ) : (
              ''
            )
          ) : (
            ''
          )
        }
        detail="This can't be undone."
        confirmLabel={deleteTarget?.type === 'folder' ? 'Delete folder' : 'Delete diagram'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {addDiagramState && (
        <AddDiagramDialog
          open={true}
          onClose={() => setAddDiagramState(null)}
          onCreated={() => {}}
          workspaceId={workspaceSlug}
          projectId={addDiagramState.projectId}
          folder={addDiagramState.folder}
        />
      )}

      {addFolderState && (
        <AddFolderDialog
          open={true}
          onClose={() => setAddFolderState(null)}
          onCreated={() => {}}
          workspaceId={workspaceSlug}
          projectId={addFolderState.projectId}
          parentFolder={addFolderState.parent ?? undefined}
        />
      )}
    </>
  );
};

const EntitiesSidebar = ({
  schemas,
  lifecycleStates,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const { permissions } = useWorkspaceContext();
  const search = useSearch({ strict: false }) as {
    type?: string;
    status?: string;
    owner?: string;
    q?: string;
    viewMode?: string;
    radarConfig?: string;
    sidebarTab?: 'filters' | 'views';
  };
  const typeFilter = search.type ?? null;
  const statusFilter = search.status ?? null;
  const ownerFilter = search.owner ?? null;
  const sidebarTab = search.sidebarTab ?? 'filters';

  const [facets, setFacets] = useState<EntityFacets | null>(null);
  const { data: savedViews = [] } = useSavedViews(workspaceSlug);
  const deleteViewMutation = useDeleteSavedView(workspaceSlug);
  const updateViewMutation = useUpdateSavedView(workspaceSlug);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const [renameViewTarget, setRenameViewTarget] = useState<SavedView | null>(null);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setFacets(null);
      return;
    }
    fetchEntityFacets(workspaceSlug)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [workspaceSlug]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (facets?.lifecycle ?? []).forEach(bucket => {
      const key = bucket.value ?? 'none';
      counts[key] = bucket.count;
    });
    return counts;
  }, [facets]);

  const owners = useMemo(() => {
    return (facets?.owner ?? [])
      .map(bucket => [bucket.value ?? 'Unassigned', bucket.count] as const)
      .sort((a, b) => b[1] - a[1]);
  }, [facets]);

  const totalEntities = facets?.total ?? schemas.reduce((sum, s) => sum + s.entity_count, 0);

  const navigateEntities = (params: {
    type?: string;
    status?: string;
    owner?: string;
    sidebarTab?: 'filters' | 'views';
  }) => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        ...search,
        ...params
        // biome-ignore lint/suspicious/noExplicitAny: bypass
      } as any
    });
  };

  const applySavedView = (view: SavedView) => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        type: view.filters.schemaId ?? undefined,
        status: view.filters.status ?? undefined,
        owner: view.filters.owner ?? undefined,
        q: view.filters.q ?? undefined,
        viewMode: view.viewMode,
        radarConfig: view.config?.radar ? JSON.stringify(view.config.radar) : undefined,
        sidebarTab: 'views'
        // biome-ignore lint/suspicious/noExplicitAny: bypass
      } as any
    });
  };

  const getViewIcon = (mode: string) => {
    switch (mode) {
      case 'table':
        return <TbList size={12} />;
      case 'cards':
        return <TbLayoutGrid size={12} />;
      case 'tree':
        return <TbBinaryTree2 size={12} />;
      case 'radar':
        return <TbChartRadar size={12} />;
      default:
        return <TbTable size={12} />;
    }
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root
          value={sidebarTab}
          onValueChange={v => navigateEntities({ sidebarTab: v as 'filters' | 'views' })}
        >
          <Tabs.List>
            <Tabs.Trigger value="filters">Filters</Tabs.Trigger>
            <Tabs.Trigger value="views">Views</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>

      <div className={styles.scroll}>
        {sidebarTab === 'filters' ? (
          <>
            <TreeRow
              icon={<TbDatabase size={12} />}
              label="All entities"
              active={!typeFilter && !statusFilter && !ownerFilter}
              onClick={() =>
                navigateEntities({ type: undefined, status: undefined, owner: undefined })
              }
              trailing={<span className="dim mono">{totalEntities}</span>}
            />
            <GroupLabel>By type</GroupLabel>
            {schemas.map((s, i) => (
              <TreeRow
                key={s.id}
                icon={
                  <TypeBadge
                    color={resolveSchemaColor(s, i)}
                    name={s.name}
                    icon={s.icon}
                    size={14}
                  />
                }
                label={s.name}
                active={typeFilter === s.id}
                onClick={() => navigateEntities({ type: typeFilter === s.id ? undefined : s.id })}
                trailing={<span className="dim mono">{s.entity_count}</span>}
                tagColor={resolveSchemaColor(s, i)}
              />
            ))}
            <GroupLabel>By status</GroupLabel>
            {lifecycleStates.map(s => {
              const count = statusCounts[s.id] ?? 0;
              if (!count) return null;
              return (
                <TreeRow
                  key={s.id}
                  icon={
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.color
                      }}
                    />
                  }
                  label={s.label}
                  active={statusFilter === s.id}
                  onClick={() =>
                    navigateEntities({ status: statusFilter === s.id ? undefined : s.id })
                  }
                  trailing={<span className="dim mono">{count}</span>}
                />
              );
            })}
            <GroupLabel>By owner</GroupLabel>
            {owners.map(([owner, count]) => (
              <TreeRow
                key={owner}
                icon={<TbUsers size={12} />}
                label={owner}
                active={ownerFilter === owner}
                onClick={() =>
                  navigateEntities({ owner: ownerFilter === owner ? undefined : owner })
                }
                trailing={<span className="dim mono">{count}</span>}
              />
            ))}
          </>
        ) : (
          <>
            <GroupLabel>Saved views</GroupLabel>
            {savedViews.length === 0 && (
              <div className={`${styles.emptyState} dim`}>No saved views yet.</div>
            )}
            {savedViews.map(view => (
              <TreeRow
                key={view.id}
                icon={getViewIcon(view.viewMode)}
                label={view.name}
                onClick={() => applySavedView(view)}
                onContextMenu={e => {
                  if (!permissions.canManageViews) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setViewMenu({ x: e.clientX, y: e.clientY, view });
                }}
              />
            ))}
          </>
        )}
      </div>

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

      {renameViewTarget && (
        <SidebarRenameDialog
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
    </>
  );
};

const DataModelSidebar = ({
  schemas,
  enums,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    tab?: 'types' | 'enums' | 'graph';
    schema?: string;
    enumId?: string;
  };
  const activeTab = search.tab === 'enums' ? 'enums' : 'types';
  const isGraphOverviewActive = search.tab === 'graph';
  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;

  const activateTab = (tab: 'types' | 'enums') => {
    navigate({
      to: '/$workspaceSlug/model',
      params: { workspaceSlug },
      search: { tab }
    });
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root
          value={activeTab}
          onValueChange={value => activateTab(value as 'types' | 'enums')}
        >
          <Tabs.List>
            <Tabs.Trigger value="types">Types</Tabs.Trigger>
            <Tabs.Trigger value="enums">Enums</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          <GroupLabel>Entity types</GroupLabel>
          {schemas.map((s, i) => (
            <TreeRow
              key={s.id}
              icon={
                <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />
              }
              label={s.name}
              active={schemaId === s.id}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/model',
                  params: { workspaceSlug },
                  search: { tab: 'types', schema: s.id }
                })
              }
              tagColor={resolveSchemaColor(s, i)}
              trailing={<span className="dim mono">{s.fields.length}</span>}
            />
          ))}
          <GroupLabel>Views</GroupLabel>
          <TreeRow
            icon={<TbVectorTriangle size={12} />}
            label="Graph Overview"
            active={isGraphOverviewActive}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/model',
                params: { workspaceSlug },
                search: { tab: 'graph' }
              })
            }
          />
        </div>
      ) : (
        <div className={styles.scroll}>
          <GroupLabel>Enums</GroupLabel>
          {enums.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No enums defined.</div>
          )}
          {enums.map(e => (
            <TreeRow
              key={e.id}
              icon={<TbTable size={12} />}
              label={e.name}
              active={enumId === e.id}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/model',
                  params: { workspaceSlug },
                  search: { tab: 'enums', enumId: e.id }
                })
              }
              trailing={<span className="dim mono">{e.options.length}</span>}
            />
          ))}
        </div>
      )}
    </>
  );
};

const SearchSidebar = () => (
  <>
    <SectionHeader title="Search" />
    <div className={styles.scroll} style={{ padding: 8 }}>
      <div className="dim">Type in the top bar to search.</div>
    </div>
  </>
);

type SettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  tone?: string;
};

const SETTINGS_SECTIONS: SettingsNavItem[] = [
  { id: 'general', label: 'General', icon: <TbSettings size={12} />, group: 'Workspace' },
  { id: 'lifecycle-owners', label: 'Lifecycle', icon: <TbTag size={12} />, group: 'Workspace' },
  { id: 'members', label: 'Members', icon: <TbUsers size={12} />, group: 'People' },
  { id: 'teams', label: 'Teams', icon: <TbUsers size={12} />, group: 'People' },
  { id: 'roles', label: 'Roles & permissions', icon: <TbShieldLock size={12} />, group: 'People' },
  {
    id: 'global-permissions',
    label: 'Global permissions',
    icon: <TbShieldLock size={12} />,
    group: 'Global Settings'
  },
  { id: 'ai', label: 'AI', icon: <TbSparkles size={12} />, group: 'Workspace' },
  { id: 'audit', label: 'Audit log', icon: <TbHistory size={12} />, group: 'Workspace' },
  {
    id: 'danger',
    label: 'Danger zone',
    icon: <TbTrash size={12} />,
    group: 'Workspace',
    tone: 'danger'
  }
];

const SettingsSidebar = ({
  workspace,
  workspaceSlug,
  schemas,
  projects,
  availableSections
}: {
  workspace: import('../api').Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  projects: Project[];
  availableSections: string[];
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: string };
  const section = search.section ?? 'general';

  const groups = useMemo(() => {
    const g: Record<string, SettingsNavItem[]> = {};
    SETTINGS_SECTIONS.filter(s => availableSections.includes(s.id)).forEach(s => {
      (g[s.group] ??= []).push(s);
    });
    return Object.entries(g);
  }, [availableSections]);

  const entityCount = schemas.reduce((sum, s) => sum + s.entity_count, 0);

  return (
    <>
      <SectionHeader title="Settings" />
      <div className={styles.scroll}>
        {workspace && (
          <div className={styles.settingsWsHead}>
            <div className={styles.settingsWsBadge}>{workspace.short_code}</div>
            <div>
              <div className={styles.settingsWsName}>{workspace.name}</div>
              <div className="dim" style={{ fontSize: 11 }}>
                {entityCount} entities · {projects.length} projects
              </div>
            </div>
          </div>
        )}
        {groups.map(([group, items]) => (
          <div key={group}>
            <GroupLabel>{group}</GroupLabel>
            {items.map(s => (
              <TreeRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={section === s.id}
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/settings',
                    params: { workspaceSlug },
                    search: { section: s.id }
                  })
                }
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
