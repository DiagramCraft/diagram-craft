import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useMatches, useSearch } from '@tanstack/react-router';
import styles from './SidePanel.module.css';
import { TreeRow } from '../components/TreeRow';
import { TypeBadge } from '../components/TypeBadge';
import { ContextMenu, type ContextMenuItem } from '../components/ContextMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import {
  TbFolders, TbDatabase,
  TbUsers, TbFileVector, TbFolderOpen,
  TbSettings, TbTrash, TbTag, TbHistory,
  TbShieldLock, TbPlus, TbPencil, TbCopy,
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
} from '../hooks/useProjectFiles';
import type { EntityFacets, EntitySchema, Project, WorkspaceLifecycleState } from '../api';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { deriveActiveView } from '../layouts/deriveActiveView';
import { AddDiagramDialog } from '../dialogs/AddDiagramDialog';
import { AddFolderDialog } from '../dialogs/AddFolderDialog';

const PROJECT_GROUPS = [
  { status: 'pinned', title: 'Pinned Projects' },
  { status: 'active', title: 'Active Projects' },
] as const;

const ARCHIVED_PROJECT_GROUP = { status: 'archived', title: 'Archived Projects' } as const;

type ProjectSidebarTab = 'projects' | 'archive';

export const SidePanel = () => {
  const matches = useMatches();
  const view = deriveActiveView(matches);
  const ctx = useWorkspaceContext();

  let body: React.ReactNode;

  if (view === 'home') {
    body = <HomeSidebar schemas={ctx.schemas} projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />;
  } else if (view === 'project-detail') {
    body = (
      <ProjectsSidebar
        projects={ctx.projects}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'entity-browser' || view === 'entity-detail') {
    body = (
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={ctx.workspaceSlug}
      />
    );
  } else if (view === 'data-model') {
    body = <DataModelSidebar schemas={ctx.schemas} workspaceSlug={ctx.workspaceSlug} />;
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
  }

  return <div className={styles.panel}>{body}</div>;
};

const SectionHeader = ({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <div className={`${styles.headerTab} ${styles.headerTabActive}`}>{title}</div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

const getSidebarProjectGroups = (projects: Project[]) =>
  PROJECT_GROUPS
    .map(group => ({
      ...group,
      projects: projects.filter(project => project.status === group.status),
    }))
    .filter(group => group.projects.length > 0);

const getArchivedProjectGroup = (projects: Project[]) => ({
  ...ARCHIVED_PROJECT_GROUP,
  projects: projects.filter(project => project.status === ARCHIVED_PROJECT_GROUP.status),
});

const HomeSidebar = ({ schemas, projects, workspaceSlug }: { schemas: EntitySchema[]; projects: Project[]; workspaceSlug: string }) => {
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
                icon={<TbFolders size={12} />}
                label={p.name}
                onClick={() => navigate({
                  to: '/$workspaceSlug/projects/$projectId',
                  params: { workspaceSlug, projectId: p.id },
                  search: { tab: p.status === 'archived' ? 'archive' as const : 'projects' as const },
                })}
                trailing={<span className="dim mono">{p.file_count}</span>}
              />
            ))}
          </div>
        ))}
        <GroupLabel>Data model</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={<TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />}
            label={s.name}
            onClick={() => navigate({
              to: '/$workspaceSlug/entities',
              params: { workspaceSlug },
              search: { type: s.id },
            })}
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
  onCancel,
}: {
  open: boolean;
  currentName: string;
  entityType: 'diagram' | 'folder';
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
        if (el) { el.focus(); el.select(); }
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
          <label style={{ fontSize: 12, color: 'var(--fg-2)' }}>Name</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              fontSize: 13,
              padding: '6px 8px',
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--fg-0)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className={styles.renameBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" className={styles.renameBtnPrimary} disabled={!name.trim()}>Rename</button>
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
  workspaceSlug,
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
  const [menu, setMenu] = useState<{ x: number; y: number; target: SidebarMenuTarget } | null>(null);
  const [renameTarget, setRenameTarget] = useState<SidebarMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SidebarMenuTarget | null>(null);
  const [addDiagramState, setAddDiagramState] = useState<{ projectId: string; folder: string | null } | null>(null);
  const [addFolderState, setAddFolderState] = useState<{ projectId: string; parent: string | null } | null>(null);

  // Mutation hooks for the selected project
  const deleteFileMutation = useDeleteProjectFile(workspaceSlug, projectId ?? '');
  const deleteFolderMutation = useDeleteProjectFolder(workspaceSlug, projectId ?? '');
  const renameFolderMutation = useRenameProjectFolder(workspaceSlug, projectId ?? '');
  const cloneFileMutation = useCloneProjectFile(workspaceSlug, projectId ?? '');
  const renameFileMutation = useRenameProjectFile(workspaceSlug, projectId ?? '');

  const openMenu = (e: React.MouseEvent, target: SidebarMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  const getMenuItems = (target: SidebarMenuTarget): ContextMenuItem[] => {
    if (target.type === 'project') {
      return [
        { label: 'New diagram', icon: <TbPlus size={13} />, onClick: () => setAddDiagramState({ projectId: target.projectId, folder: null }) },
        { label: 'New folder', icon: <TbFolderOpen size={13} />, onClick: () => setAddFolderState({ projectId: target.projectId, parent: null }) },
      ];
    }
    if (target.type === 'folder') {
      return [
        { label: 'New diagram', icon: <TbPlus size={13} />, onClick: () => setAddDiagramState({ projectId: target.projectId, folder: target.path }) },
        { label: 'New folder', icon: <TbFolderOpen size={13} />, onClick: () => setAddFolderState({ projectId: target.projectId, parent: target.path }) },
        { label: 'Rename', icon: <TbPencil size={13} />, separatorBefore: true, onClick: () => setRenameTarget(target) },
        { label: 'Delete', icon: <TbTrash size={13} />, danger: true, separatorBefore: true, onClick: () => setDeleteTarget(target) },
      ];
    }
    // diagram
    return [
      { label: 'Clone', icon: <TbCopy size={13} />, onClick: () => cloneFileMutation.mutate(target.file) },
      { label: 'Rename', icon: <TbPencil size={13} />, onClick: () => setRenameTarget(target) },
      { label: 'Delete', icon: <TbTrash size={13} />, danger: true, separatorBefore: true, onClick: () => setDeleteTarget(target) },
    ];
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
    if (!trimmed) { setRenameTarget(null); return; }
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

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const projectGroups = projectSidebarTab === 'archive'
    ? [getArchivedProjectGroup(projects)].filter(group => group.projects.length > 0)
    : getSidebarProjectGroups(projects);

  useEffect(() => {
    if (!selectedProject) return;
    const nextTab = selectedProject.status === 'archived' ? 'archive' : 'projects';
    if (nextTab !== projectSidebarTab) {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: { tab: nextTab as 'projects' | 'archive', folder: folderFilter ?? undefined },
      });
    }
  }, [selectedProject, projectSidebarTab, navigate, workspaceSlug, folderFilter]);

  const navigateToProject = (project: Project, folder?: string | null) => {
    navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug, projectId: project.id },
      search: {
        tab: (project.status === 'archived' ? 'archive' : 'projects') as 'projects' | 'archive',
        folder: folder ?? undefined,
      },
    });
  };

  const activateTab = (tab: ProjectSidebarTab) => {
    const targetProjects = tab === 'archive'
      ? projects.filter(project => project.status === 'archived')
      : projects.filter(project => project.status !== 'archived');

    if (!selectedProject || !targetProjects.some(project => project.id === selectedProject.id)) {
      const target = targetProjects[0];
      if (target) {
        navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug, projectId: target.id },
          search: { tab },
        });
      }
    } else {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: { tab },
      });
    }
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <button
          type="button"
          className={`${styles.headerTab} ${projectSidebarTab === 'projects' ? styles.headerTabActive : ''}`}
          onClick={() => activateTab('projects')}
        >
          Projects
        </button>
        <button
          type="button"
          className={`${styles.headerTab} ${projectSidebarTab === 'archive' ? styles.headerTabActive : ''}`}
          onClick={() => activateTab('archive')}
        >
          Archive
        </button>
      </div>
      <div className={styles.scroll}>
        {projectGroups.length > 0 ? projectGroups.map(group => (
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
                    icon={<TbFolders size={12} />}
                    label={p.name}
                    active={isSelected && !folderFilter}
                    onClick={() => navigateToProject(p)}
                    onContextMenu={e => openMenu(e, { type: 'project', projectId: p.id })}
                    trailing={<span className="dim mono">{p.file_count}</span>}
                  />
                  {isOpen && tree && (
                    <>
                      {tree.rootFiles
                        .filter(f => !f.path.endsWith('/.keep'))
                        .map(f => (
                          <TreeRow
                            key={f.id}
                            depth={1}
                            icon={<TbFileVector size={12} />}
                            label={f.name}
                            onClick={() => navigate({
                              to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
                              params: { workspaceSlug, projectId: p.id, diagramId: f.id },
                            })}
                            onContextMenu={e => openMenu(e, { type: 'diagram', file: f, projectId: p.id })}
                          />
                        ))}
                      {tree.folders.map(folder => {
                        const folderKey = `${p.id}:${folder.path}`;
                        const folderOpen = expanded[folderKey] ?? true;
                        const files = folder.files.filter(f => !f.path.endsWith('/.keep'));
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
                              onContextMenu={e => openMenu(e, { type: 'folder', path: folder.path, projectId: p.id })}
                            />
                            {folderOpen && files.map(f => (
                              <TreeRow
                                key={f.id}
                                depth={2}
                                icon={<TbFileVector size={12} />}
                                label={f.name}
                                onClick={() => navigate({
                                  to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
                                  params: { workspaceSlug, projectId: p.id, diagramId: f.id },
                                })}
                                onContextMenu={e => openMenu(e, { type: 'diagram', file: f, projectId: p.id })}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )) : (
          <div className={`${styles.emptyState} dim`}>
            {projectSidebarTab === 'archive' ? 'No archived projects.' : 'No projects.'}
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={getMenuItems(menu.target)}
          onClose={() => setMenu(null)}
        />
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

      <ConfirmDialog
        open={!!deleteTarget && deleteTarget.type !== 'project'}
        title={deleteTarget?.type === 'folder' ? 'Delete folder?' : 'Delete diagram?'}
        message={
          deleteTarget ? (
            deleteTarget.type === 'folder'
              ? <>The folder <b>{deleteTarget.path}</b> and all diagrams inside it will be permanently deleted.</>
              : deleteTarget.type === 'diagram'
                ? <>The diagram <b>{deleteTarget.file.name}</b> will be permanently deleted.</>
                : ''
          ) : ''
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
  workspaceSlug,
}: {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { type?: string; status?: string; owner?: string };
  const typeFilter = search.type ?? null;
  const statusFilter = search.status ?? null;
  const ownerFilter = search.owner ?? null;

  const [facets, setFacets] = useState<EntityFacets | null>(null);

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

  const navigateEntities = (params: { type?: string; status?: string; owner?: string }) => {
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: params,
    });
  };

  return (
    <>
      <SectionHeader title="Types" />
      <div className={styles.scroll}>
        <TreeRow
          icon={<TbDatabase size={12} />}
          label="All entities"
          active={!typeFilter && !statusFilter && !ownerFilter}
          onClick={() => navigateEntities({})}
          trailing={<span className="dim mono">{totalEntities}</span>}
        />
        <GroupLabel>By type</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={<TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />}
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
                    background: s.color,
                  }}
                />
              }
              label={s.label}
              active={statusFilter === s.id}
              onClick={() => navigateEntities({ status: statusFilter === s.id ? undefined : s.id })}
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
            onClick={() => navigateEntities({ owner: ownerFilter === owner ? undefined : owner })}
            trailing={<span className="dim mono">{count}</span>}
          />
        ))}
      </div>
    </>
  );
};

const DataModelSidebar = ({
  schemas,
  workspaceSlug,
}: {
  schemas: EntitySchema[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { schema?: string };
  const schemaId = search.schema ?? null;

  return (
    <>
      <SectionHeader title="Types" />
      <div className={styles.scroll}>
        <GroupLabel>Entity types</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={<TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />}
            label={s.name}
            active={schemaId === s.id}
            onClick={() => navigate({
              to: '/$workspaceSlug/model',
              params: { workspaceSlug },
              search: { schema: s.id },
            })}
            tagColor={resolveSchemaColor(s, i)}
            trailing={<span className="dim mono">{s.fields.length}</span>}
          />
        ))}
      </div>
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
  { id: 'global-permissions', label: 'Global permissions', icon: <TbShieldLock size={12} />, group: 'Global Settings' },
  { id: 'audit', label: 'Audit log', icon: <TbHistory size={12} />, group: 'Workspace' },
  { id: 'danger', label: 'Danger zone', icon: <TbTrash size={12} />, group: 'Workspace', tone: 'danger' },
];

const SettingsSidebar = ({
  workspace,
  workspaceSlug,
  schemas,
  projects,
  availableSections,
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
            <div className={styles.settingsWsBadge}>
              {workspace.short_code}
            </div>
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
                onClick={() => navigate({
                  to: '/$workspaceSlug/settings',
                  params: { workspaceSlug },
                  search: { section: s.id },
                })}
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
