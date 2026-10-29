import { Tabs } from '@diagram-craft/app-components/Tabs';
import { isArchivedProject } from '../../lib/projectStatus';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useMatches, useSearch } from '@tanstack/react-router';
import {
  TbFolders,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbPlus
} from 'react-icons/tb';
import { Project } from '@arch-register/api-types/projectCrudContract';
import { TreeRow } from '../../components/TreeRow';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from '../../shell/SidePanel.module.css';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';

type ProjectSidebarTab = 'projects' | 'archive';

const getSidebarProjectGroups = (projects: Project[]) => {
  const pinned = projects.filter(p => p.pinned);
  const draft = projects.filter(p => !p.pinned && p.status === 'draft');
  const active = projects.filter(p => !p.pinned && p.status === 'active');
  return [
    ...(pinned.length > 0 ? [{ title: 'Pinned Projects', projects: pinned }] : []),
    ...(draft.length > 0 ? [{ title: 'Draft Projects', projects: draft }] : []),
    ...(active.length > 0 ? [{ title: 'Active Projects', projects: active }] : [])
  ];
};

export const ProjectsSidebar = ({
  projects,
  workspaceSlug,
  onCollapse,
  onExpand
}: {
  projects: Project[];
  workspaceSlug: string;
  onCollapse?: () => void;
  onExpand?: () => void;
}) => {
  const { openAddProjectDialog, permissions } = useWorkspaceContext();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const matches = useMatches();
  const allParams = Object.assign({}, ...matches.map(m => m.params)) as Record<string, string>;
  const projectId = allParams.projectId ?? null;
  const projectFolder = allParams._splat ?? null;
  const { archivedProjects, liveProjects } = useMemo(
    () => ({
      archivedProjects: projects.filter(isArchivedProject),
      liveProjects: projects.filter(project => !isArchivedProject(project))
    }),
    [projects]
  );
  const hasArchivedProjects = archivedProjects.length > 0;
  const projectSidebarTab: ProjectSidebarTab =
    search.tab === 'archive' && hasArchivedProjects ? 'archive' : 'projects';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectedProject =
    projects.find(project => project.id === projectId || project.public_id === projectId) ?? null;

  const projectGroups =
    projectSidebarTab === 'archive'
      ? hasArchivedProjects
        ? [{ title: 'Archived Projects', projects: archivedProjects }]
        : []
      : getSidebarProjectGroups(projects);

  useEffect(() => {
    if (!selectedProject) return;
    const nextTab = isArchivedProject(selectedProject) ? 'archive' : 'projects';
    if (nextTab !== projectSidebarTab) {
      const nextSearch = {
        tab: nextTab as 'projects' | 'archive',
        section: search.section === 'entities' ? ('entities' as const) : ('home' as const),
        contentQuery: search.contentQuery,
        contentView: search.contentView
      };
      navigate(
        projectFolder
          ? projectContentFolderRoute(
              workspaceSlug,
              asProjectPublicId(selectedProject.public_id),
              projectFolder,
              nextSearch
            )
          : projectDetailRoute(
              workspaceSlug,
              asProjectPublicId(selectedProject.public_id),
              nextSearch
            )
      );
    }
  }, [
    selectedProject,
    projectSidebarTab,
    navigate,
    workspaceSlug,
    projectFolder,
    search.section,
    search.contentQuery,
    search.contentView
  ]);

  const goToProject = (project: Project, nextSearch: Parameters<typeof projectDetailRoute>[2]) =>
    navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(project.public_id), nextSearch));

  const navigateToProject = (project: Project) =>
    goToProject(project, {
      tab: isArchivedProject(project) ? 'archive' : 'projects',
      section: 'home'
    });

  const activateTab = (tab: ProjectSidebarTab) => {
    const targetProjects = tab === 'archive' ? archivedProjects : liveProjects;

    if (!selectedProject || !targetProjects.some(project => project.id === selectedProject.id)) {
      const target = targetProjects[0];
      if (target) goToProject(target, { tab, section: 'home' });
    } else {
      goToProject(selectedProject, {
        tab,
        section: search.section === 'entities' ? 'entities' : 'home'
      });
    }
  };

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <SidebarHeader
        actions={
          <>
            {permissions.canCreateProjects && (
              <button
                type="button"
                className={styles.action}
                onClick={openAddProjectDialog}
                title="New project"
              >
                <TbPlus size={13} />
              </button>
            )}
            {onExpand && (
              <button
                type="button"
                className={styles.action}
                title="Pin sidebar open"
                onClick={onExpand}
              >
                <TbLayoutSidebarLeftExpand size={14} />
              </button>
            )}
            {onCollapse && (
              <button
                type="button"
                className={styles.action}
                title="Collapse to rail"
                onClick={onCollapse}
              >
                <TbLayoutSidebarLeftCollapse size={14} />
              </button>
            )}
          </>
        }
      >
        <Tabs.Root
          value={projectSidebarTab}
          onValueChange={value => activateTab(value as 'projects' | 'archive')}
        >
          <Tabs.List>
            <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
            {hasArchivedProjects && <Tabs.Trigger value="archive">Archive</Tabs.Trigger>}
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      <div className={styles.scroll}>
        {projectGroups.length > 0 ? (
          projectGroups.map(group => (
            <div key={group.title} data-testid={`project-group-${group.title}`}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              {group.projects.map(project => {
                const isSelected = project.id === projectId || project.public_id === projectId;
                const isOpen = expanded[project.id] ?? isSelected;

                return (
                  <TreeRow
                    key={project.id}
                    expandable
                    testId={`project-row-${project.name}`}
                    expanded={isOpen}
                    onExpand={() => toggle(project.id)}
                    icon={
                      <TbFolders
                        size={12}
                        style={project.color ? { color: project.color } : undefined}
                      />
                    }
                    label={`${project.name} (${project.public_id})`}
                    active={isSelected}
                    onClick={() => navigateToProject(project)}
                    trailing={<span className="dim mono">{project.file_count}</span>}
                    tagColor={project.color ?? undefined}
                  />
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
    </>
  );
};
