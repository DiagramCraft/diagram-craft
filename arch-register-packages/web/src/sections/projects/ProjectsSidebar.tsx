import { Tabs } from '@diagram-craft/app-components/Tabs';
import { useEffect, useState } from 'react';
import { useNavigate, useMatches, useSearch } from '@tanstack/react-router';
import { TbFolders, TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand, TbPlus } from 'react-icons/tb';
import { Project } from '@arch-register/api-types/projectContract';
import { TreeRow } from '../../components/TreeRow';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from '../../shell/SidePanel.module.css';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';

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

const getArchivedProjectGroup = (projects: Project[]) => ({
  title: 'Archived Projects',
  projects: projects.filter(p => p.status === 'complete' || p.status === 'cancelled')
});

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
  const search = useSearch({ strict: false }) as {
    tab?: string;
    folder?: string;
    section?: string;
  };
  const matches = useMatches();
  const allParams = Object.assign({}, ...matches.map(m => m.params)) as Record<string, string>;
  const projectId = allParams.projectId ?? null;
  const projectSidebarTab: ProjectSidebarTab = search.tab === 'archive' ? 'archive' : 'projects';
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectedProject = projects.find(project => project.id === projectId) ?? null;

  const projectGroups =
    projectSidebarTab === 'archive'
      ? [getArchivedProjectGroup(projects)].filter(group => group.projects.length > 0)
      : getSidebarProjectGroups(projects);

  useEffect(() => {
    if (!selectedProject) return;
    const nextTab =
      selectedProject.status === 'complete' || selectedProject.status === 'cancelled'
        ? 'archive'
        : 'projects';
    if (nextTab !== projectSidebarTab) {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: {
          tab: nextTab as 'projects' | 'archive',
          folder: search.folder ?? undefined,
          section: search.section === 'entities' ? 'entities' : 'home'
        }
      });
    }
  }, [selectedProject, projectSidebarTab, navigate, workspaceSlug, search.folder, search.section]);

  const navigateToProject = (project: Project) => {
    navigate({
      to: '/$workspaceSlug/projects/$projectId',
      params: { workspaceSlug, projectId: project.id },
      search: {
        tab:
          project.status === 'complete' || project.status === 'cancelled' ? 'archive' : 'projects',
        section: 'home'
      }
    });
  };

  const activateTab = (tab: ProjectSidebarTab) => {
    const targetProjects =
      tab === 'archive'
        ? projects.filter(project => project.status === 'complete' || project.status === 'cancelled')
        : projects.filter(project => project.status !== 'complete' && project.status !== 'cancelled');

    if (!selectedProject || !targetProjects.some(project => project.id === selectedProject.id)) {
      const target = targetProjects[0];
      if (target) {
        navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug, projectId: target.id },
          search: { tab, section: 'home' }
        });
      }
    } else {
      navigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId: selectedProject.id },
        search: {
          tab,
          folder: search.folder ?? undefined,
          section: search.section === 'entities' ? 'entities' : 'home'
        }
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
            <Tabs.Trigger value="archive">Archive</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      <div className={styles.scroll}>
        {projectGroups.length > 0 ? (
          projectGroups.map(group => (
            <div key={group.title} data-testid={`project-group-${group.title}`}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              {group.projects.map(project => {
                const isSelected = project.id === projectId;
                const isOpen = expanded[project.id] ?? isSelected;

                return (
                  <div key={project.id}>
                    <TreeRow
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
                      label={project.name}
                      active={isSelected}
                      onClick={() => navigateToProject(project)}
                      trailing={<span className="dim mono">{project.file_count}</span>}
                      tagColor={project.color ?? undefined}
                    />
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
    </>
  );
};
