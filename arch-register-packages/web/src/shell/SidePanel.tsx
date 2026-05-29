import { useState, useEffect, useMemo } from 'react';
import styles from './SidePanel.module.css';
import { TreeRow } from '../components/TreeRow';
import { TypeBadge } from '../components/TypeBadge';
import {
  TbStack2, TbDatabase,
  TbUsers, TbChartDots3, TbFolderOpen,
  TbSettings, TbTrash, TbTag, TbHistory,
} from 'react-icons/tb';
import type { Workspace } from '../api';
import type { ViewId, NavigateFn, RoutePatch } from '../routing';
import { fetchEntityFacets, resolveSchemaColor } from '../api';
import { useProjectFiles } from '../hooks/useProjectFiles';
import type { EntityFacets, EntitySchema, Project, WorkspaceLifecycleState } from '../api';

const PROJECT_GROUPS = [
  { status: 'pinned', title: 'Pinned Projects' },
  { status: 'active', title: 'Active Projects' },
] as const;

const ARCHIVED_PROJECT_GROUP = { status: 'archived', title: 'Archived Projects' } as const;

type ProjectSidebarTab = 'projects' | 'archive';

type SidePanelProps = {
  view: ViewId;
  navigate: NavigateFn;
  schemas: EntitySchema[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  workspace: Workspace | null;
  workspaceId: string | null;
  projectId: string | null;
  projectSidebarTab: ProjectSidebarTab;
  schemaId: string | null;
  folderFilter: string | null;
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  settingsSection: string;
  availableSettingsSections: string[];
  setProjectSidebarTab: (tab: ProjectSidebarTab) => void;
  setTypeFilter: (id: string | null) => void;
  setStatusFilter: (id: string | null) => void;
  setOwnerFilter: (id: string | null) => void;
};

export const SidePanel = ({
  view,
  navigate,
  schemas,
  projects,
  lifecycleStates,
  workspace,
  workspaceId,
  projectId,
  projectSidebarTab,
  schemaId,
  folderFilter,
  typeFilter,
  statusFilter,
  ownerFilter,
  settingsSection,
  availableSettingsSections,
  setProjectSidebarTab,
  setTypeFilter,
  setStatusFilter,
  setOwnerFilter,
}: SidePanelProps) => {
  let body: React.ReactNode;

  if (view === 'home') {
    body = <HomeSidebar navigate={navigate} schemas={schemas} projects={projects} />;
  } else if (view === 'project-detail') {
    body = (
      <ProjectsSidebar
        projects={projects}
        projectId={projectId}
        projectSidebarTab={projectSidebarTab}
        folderFilter={folderFilter}
        workspaceId={workspaceId}
        navigate={navigate}
        setProjectSidebarTab={setProjectSidebarTab}
      />
    );
  } else if (view === 'entity-browser' || view === 'entity-detail') {
    body = (
      <EntitiesSidebar
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        workspaceId={workspaceId}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        ownerFilter={ownerFilter}
        navigate={navigate}
        setTypeFilter={setTypeFilter}
        setStatusFilter={setStatusFilter}
        setOwnerFilter={setOwnerFilter}
      />
    );
  } else if (view === 'data-model') {
    body = <DataModelSidebar schemas={schemas} navigate={navigate} schemaId={schemaId} />;
  } else if (view === 'search') {
    body = <SearchSidebar />;
  } else if (view === 'workspace-settings') {
    body = (
        <SettingsSidebar
          workspace={workspace}
          section={settingsSection}
          navigate={navigate}
          schemas={schemas}
          projects={projects}
          availableSections={availableSettingsSections}
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

const HomeSidebar = ({ navigate, schemas, projects }: { navigate: NavigateFn; schemas: EntitySchema[]; projects: Project[] }) => (
  <>
    <SectionHeader title="Overview" />
    <div className={styles.scroll}>
      {getSidebarProjectGroups(projects).map(group => (
        <div key={group.status}>
          <GroupLabel>{group.title}</GroupLabel>
          {group.projects.map(p => (
            <TreeRow
              key={p.id}
              icon={<TbStack2 size={12} />}
              label={p.name}
              onClick={() => navigate({
                view: 'project-detail',
                projectId: p.id,
                projectSidebarTab: p.status === 'archived' ? 'archive' : 'projects',
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
          onClick={() => navigate({ view: 'entity-browser', typeFilter: s.id })}
          trailing={<span className="dim mono">{s.entity_count}</span>}
          tagColor={resolveSchemaColor(s, i)}
        />
      ))}
    </div>
  </>
);

const ProjectsSidebar = ({
  projects,
  projectId,
  projectSidebarTab,
  folderFilter,
  workspaceId,
  navigate,
  setProjectSidebarTab,
}: {
  projects: Project[];
  projectId: string | null;
  projectSidebarTab: ProjectSidebarTab;
  folderFilter: string | null;
  workspaceId: string | null;
  navigate: NavigateFn;
  setProjectSidebarTab: (tab: ProjectSidebarTab) => void;
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectedProject = projects.find(project => project.id === projectId) ?? null;

  const { data: fileTree = null } = useProjectFiles(workspaceId ?? '', projectId ?? '');

  const toggle = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const projectGroups = projectSidebarTab === 'archive'
    ? [getArchivedProjectGroup(projects)].filter(group => group.projects.length > 0)
    : getSidebarProjectGroups(projects);

  useEffect(() => {
    if (!selectedProject) return;
    const nextTab = selectedProject.status === 'archived' ? 'archive' : 'projects';
    if (nextTab !== projectSidebarTab) {
      setProjectSidebarTab(nextTab);
    }
  }, [selectedProject, projectSidebarTab, setProjectSidebarTab]);

  const navigateToProject = (project: Project, patch: RoutePatch = {}) => {
    navigate({
      view: 'project-detail',
      projectId: project.id,
      projectSidebarTab: project.status === 'archived' ? 'archive' : 'projects',
      ...patch,
    });
  };

  const activateTab = (tab: ProjectSidebarTab) => {
    setProjectSidebarTab(tab);

    const targetProjects = tab === 'archive'
      ? projects.filter(project => project.status === 'archived')
      : projects.filter(project => project.status !== 'archived');

    if (!selectedProject || !targetProjects.some(project => project.id === selectedProject.id)) {
      navigate({
        view: 'project-detail',
        projectId: targetProjects[0]?.id ?? null,
        projectSidebarTab: tab,
        folderFilter: null,
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
                    icon={<TbStack2 size={12} />}
                    label={p.name}
                    active={isSelected && !folderFilter}
                    onClick={() => navigateToProject(p, { folderFilter: null })}
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
                            icon={<TbChartDots3 size={12} />}
                            label={f.name}
                            onClick={() => navigate({
                              view: 'diagram',
                              diagramId: f.id,
                              projectId: p.id,
                              projectSidebarTab: p.status === 'archived' ? 'archive' : 'projects',
                            })}
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
                              onClick={() => navigateToProject(p, { folderFilter: folder.path })}
                            />
                            {folderOpen && files.map(f => (
                              <TreeRow
                                key={f.id}
                                depth={2}
                                icon={<TbChartDots3 size={12} />}
                                label={f.name}
                                onClick={() => navigate({
                                  view: 'diagram',
                                  diagramId: f.id,
                                  projectId: p.id,
                                  projectSidebarTab: p.status === 'archived' ? 'archive' : 'projects',
                                })}
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
    </>
  );
};

const EntitiesSidebar = ({
  schemas,
  lifecycleStates,
  workspaceId,
  typeFilter,
  statusFilter,
  ownerFilter,
  navigate,
  setTypeFilter,
  setStatusFilter,
  setOwnerFilter,
}: {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  workspaceId: string | null;
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  navigate: NavigateFn;
  setTypeFilter: (id: string | null) => void;
  setStatusFilter: (id: string | null) => void;
  setOwnerFilter: (id: string | null) => void;
}) => {
  const [facets, setFacets] = useState<EntityFacets | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setFacets(null);
      return;
    }
    fetchEntityFacets(workspaceId)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [workspaceId]);

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

  return (
    <>
      <SectionHeader title="Types" />
      <div className={styles.scroll}>
        <TreeRow
          icon={<TbDatabase size={12} />}
          label="All entities"
          active={!typeFilter && !statusFilter && !ownerFilter}
          onClick={() => { navigate({ view: 'entity-browser' }); setTypeFilter(null); setStatusFilter(null); setOwnerFilter(null); }}
          trailing={<span className="dim mono">{totalEntities}</span>}
        />
        <GroupLabel>By type</GroupLabel>
        {schemas.map((s, i) => (
          <TreeRow
            key={s.id}
            icon={<TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />}
            label={s.name}
            active={typeFilter === s.id}
            onClick={() => { navigate({ view: 'entity-browser' }); setStatusFilter(null); setOwnerFilter(null); setTypeFilter(typeFilter === s.id ? null : s.id); }}
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
              onClick={() => { navigate({ view: 'entity-browser' }); setTypeFilter(null); setOwnerFilter(null); setStatusFilter(statusFilter === s.id ? null : s.id); }}
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
            onClick={() => { navigate({ view: 'entity-browser' }); setTypeFilter(null); setStatusFilter(null); setOwnerFilter(ownerFilter === owner ? null : owner); }}
            trailing={<span className="dim mono">{count}</span>}
          />
        ))}
      </div>
    </>
  );
};

const DataModelSidebar = ({
  schemas,
  navigate,
  schemaId,
}: {
  schemas: EntitySchema[];
  navigate: NavigateFn;
  schemaId: string | null;
}) => (
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
          onClick={() => navigate({ view: 'data-model', schemaId: s.id })}
          tagColor={resolveSchemaColor(s, i)}
          trailing={<span className="dim mono">{s.fields.length}</span>}
        />
      ))}
    </div>
  </>
);

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
  { id: 'lifecycle-owners', label: 'Lifecycle & Owners', icon: <TbTag size={12} />, group: 'Workspace' },
  { id: 'audit', label: 'Audit log', icon: <TbHistory size={12} />, group: 'Workspace' },
  { id: 'danger', label: 'Danger zone', icon: <TbTrash size={12} />, group: 'Workspace', tone: 'danger' },
];

const SettingsSidebar = ({
  workspace,
  section,
  navigate,
  schemas,
  projects,
  availableSections,
}: {
  workspace: Workspace | null;
  section: string;
  navigate: NavigateFn;
  schemas: EntitySchema[];
  projects: Project[];
  availableSections: string[];
}) => {
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
                onClick={() => navigate({ view: 'workspace-settings', settingsSection: s.id })}
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
