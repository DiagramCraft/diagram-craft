import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useMatches, useSearch } from '@tanstack/react-router';
import styles from './SidePanel.module.css';
import { TreeRow } from '../components/TreeRow';
import { TypeBadge } from '../components/TypeBadge';
import {
  TbStack2, TbDatabase,
  TbUsers, TbChartDots3, TbFolderOpen,
  TbSettings, TbTrash, TbTag, TbHistory,
  TbShieldLock,
} from 'react-icons/tb';
import { fetchEntityFacets, resolveSchemaColor } from '../api';
import { useProjectFiles } from '../hooks/useProjectFiles';
import type { EntityFacets, EntitySchema, Project, WorkspaceLifecycleState } from '../api';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { deriveActiveView } from '../layouts/deriveActiveView';

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
                icon={<TbStack2 size={12} />}
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
                    icon={<TbStack2 size={12} />}
                    label={p.name}
                    active={isSelected && !folderFilter}
                    onClick={() => navigateToProject(p)}
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
                              to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
                              params: { workspaceSlug, projectId: p.id, diagramId: f.id },
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
                              onClick={() => navigateToProject(p, folder.path)}
                            />
                            {folderOpen && files.map(f => (
                              <TreeRow
                                key={f.id}
                                depth={2}
                                icon={<TbChartDots3 size={12} />}
                                label={f.name}
                                onClick={() => navigate({
                                  to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
                                  params: { workspaceSlug, projectId: p.id, diagramId: f.id },
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
  { id: 'lifecycle-owners', label: 'Lifecycle & Owners', icon: <TbTag size={12} />, group: 'Workspace' },
  { id: 'roles', label: 'Roles & permissions', icon: <TbShieldLock size={12} />, group: 'People' },
  { id: 'members', label: 'Members', icon: <TbUsers size={12} />, group: 'People' },
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
