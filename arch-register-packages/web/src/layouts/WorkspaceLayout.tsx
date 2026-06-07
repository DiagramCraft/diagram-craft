import { useState, useCallback, useMemo } from 'react';
import { Outlet, useParams, useNavigate, useMatches } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import styles from './WorkspaceLayout.module.css';
import { TopBar } from '../shell/TopBar';
import type { BreadcrumbItem } from '../shell/TopBar';
import { NavRail, type NavRailItem } from '@diagram-craft/app-components/NavRail';
import { SidePanel } from '../shell/SidePanel';
import { AddWorkspaceDialog } from '../dialogs/AddWorkspaceDialog';
import { AddEntityDialog } from '../dialogs/AddEntityDialog';
import { AddProjectDialog } from '../dialogs/AddProjectDialog';
import { useWorkspaces, workspaceKeys } from '../hooks/useWorkspaces';
import { projectKeys } from '../hooks/useProjects';
import { useSchemas } from '../hooks/useSchemas';
import { useEnums } from '../hooks/useEnums';
import { useProjects } from '../hooks/useProjects';
import { useWorkspaceConfig } from '../hooks/useWorkspaceConfig';
import { useAiConfig } from '../hooks/useAiConfig';
import { useWorkspacePermissions } from '../auth/useWorkspacePermissions';
import { useAuthorizationData } from '../auth/AuthorizationDataContext';
import { WorkspaceContext } from './WorkspaceContext';
import { deriveActiveView } from './deriveActiveView';
import type { ViewId } from './viewId';
import type { Project } from '../api';
import { RouteContentBoundary } from '../routes/RouteContentBoundary';
import { AppErrorState } from '../components/AppErrorState';
import {
  TbHome, TbFolders, TbDatabase, TbCode, TbSearch, TbSettings,
  TbSparkles, TbWand, TbMessageCircleStar, TbFileAi,
} from 'react-icons/tb';

const ALL_RAIL_ITEMS: NavRailItem[] = [
  { id: 'home', icon: TbHome, tooltip: 'Workspace overview' },
  { id: 'projects', icon: TbFolders, tooltip: 'Projects' },
  { id: 'entities', icon: TbDatabase, tooltip: 'Entities' },
  { id: 'model', icon: TbCode, tooltip: 'Data model' },
  { id: 'search', icon: TbSearch, tooltip: 'Search' },
  { id: 'assistant', icon: TbMessageCircleStar, tooltip: 'AI Assistant', separator: true },
  { id: 'extract', icon: TbFileAi, tooltip: 'AI Extract' },
];

const VIEW_TO_RAIL: Record<string, string> = {
  home: 'home',
  'project-detail': 'projects',
  'entity-browser': 'entities',
  'entity-detail': 'entities',
  'data-model': 'model',
  search: 'search',
  assistant: 'assistant',
  extract: 'extract',
};

const SCHEMA_RESTRICTED_IDS = new Set(['home', 'projects', 'entities', 'search']);

const RAIL_TO_PATH: Record<string, string> = {
  home: '',
  projects: 'projects',
  entities: 'entities',
  model: 'model',
  search: 'search',
  assistant: 'assistant',
  extract: 'extract',
};

const getProjectSidebarTab = (project: Project | undefined): 'projects' | 'archive' =>
  project?.status === 'archived' ? 'archive' : 'projects';

const getDefaultProject = (projects: Project[]): Project | undefined =>
  projects.find(p => p.status !== 'archived') ?? projects[0];


export const WorkspaceLayout = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const matches = useMatches();
  const activeView = deriveActiveView(matches);

  const [query, setQuery] = useState('');
  const [addWsOpen, setAddWsOpen] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const { data: workspaces = [], error: workspacesError, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const ws = workspaces.find(w => w.url_slug === workspaceSlug) ?? null;

  const { data: schemas = [], error: schemasError } = useSchemas(workspaceSlug, !!workspaceSlug);
  const { data: enums = [], error: enumsError } = useEnums(workspaceSlug, !!workspaceSlug);
  const { data: projects = [], error: projectsError } = useProjects(workspaceSlug);
  const { lifecycleStates, teams } = useWorkspaceConfig(workspaceSlug, !!workspaceSlug);
  const { data: aiConfig } = useAiConfig(workspaceSlug, !!workspaceSlug);

  const {
    canManageWorkspaces,
    canViewSchemas,
    canEditSchemas,
    canManageTeams,
    canViewAudit,
    canCreateProjects,
    canCreateEntities,
    canManageMembers,
    canManageViews,
  } = useWorkspacePermissions(ws?.id);

  // Get global permissions separately for the global settings link
  const authData = useAuthorizationData();
  const canManageGlobalRoles = authData?.global_permissions?.includes('manage_workspace_roles') ?? false;

  const availableSettingsSections = useMemo(() => [
    ...(canManageWorkspaces ? ['general', 'danger'] : []),
    ...(canManageTeams ? ['lifecycle-owners', 'teams'] : []),
    ...(canManageMembers ? ['roles', 'members'] : []),
    ...(canManageWorkspaces ? ['ai'] : []),
    ...(canViewAudit ? ['audit'] : []),
  ], [canManageWorkspaces, canManageTeams, canManageMembers, canViewAudit]);

  const defaultSettingsSection = availableSettingsSections[0] ?? null;

  const showSidebar = activeView !== 'search' && activeView !== 'diagram'
    && activeView !== 'assistant' && activeView !== 'extract';

  const handleRailPick = useCallback((id: string) => {
    if (id === 'model' && !canViewSchemas) return;
    if (id === 'projects') {
      const defaultProject = getDefaultProject(projects);
      if (defaultProject) {
        navigate({
          to: '/$workspaceSlug/projects/$projectId',
          params: { workspaceSlug, projectId: defaultProject.id },
          search: { tab: getProjectSidebarTab(defaultProject) },
        });
      } else {
        setAddProjectOpen(true);
      }
      return;
    }
    const path = RAIL_TO_PATH[id];
    if (path !== undefined) {
      navigate({
        to: path === '' ? '/$workspaceSlug' : `/$workspaceSlug/${path}` as string,
        params: { workspaceSlug },
      });
    }
  }, [canViewSchemas, navigate, projects, workspaceSlug]);

  const handlePickWs = useCallback((wsId: string) => {
    const target = workspaces.find(w => w.id === wsId);
    if (target) {
      navigate({ to: '/$workspaceSlug', params: { workspaceSlug: target.url_slug } });
    }
  }, [navigate, workspaces]);

  const handleQuerySubmit = useCallback((nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (trimmed !== '') {
      navigate({
        to: '/$workspaceSlug/search',
        params: { workspaceSlug },
        search: { q: trimmed },
      });
    }
  }, [navigate, workspaceSlug]);

  const handleOpenSettings = useCallback(() => {
    if (defaultSettingsSection) {
      navigate({
        to: '/$workspaceSlug/settings',
        params: { workspaceSlug },
        search: { section: defaultSettingsSection },
      });
    }
  }, [defaultSettingsSection, navigate, workspaceSlug]);

  const handleOpenGlobalSettings = useCallback(() => {
    navigate({ 
      to: '/$workspaceSlug/settings/global',
      params: { workspaceSlug }
    });
  }, [navigate, workspaceSlug]);

  const visibleRailItems = useMemo(() => {
    const aiEnabled = aiConfig?.enabled === true;
    return ALL_RAIL_ITEMS
      .filter(item => canViewSchemas || SCHEMA_RESTRICTED_IDS.has(item.id))
      .filter(item => aiEnabled || (item.id !== 'assistant' && item.id !== 'extract'));
  }, [canViewSchemas, aiConfig?.enabled]);

  const trail = buildTrail(activeView, workspaceSlug, projects, matches, navigate);

  const contextValue = useMemo(() => ({
    workspace: ws,
    workspaceSlug,
    schemas,
    enums,
    projects,
    lifecycleStates,
    teams,
    permissions: {
      canManageWorkspaces,
      canViewSchemas,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities,
      canManageMembers,
      canManageViews,
    },
    availableSettingsSections,
    defaultSettingsSection,
    openAddProjectDialog: () => setAddProjectOpen(true),
    openAddEntityDialog: () => setAddEntityOpen(true),
  }), [
    ws, workspaceSlug, schemas, enums, projects, lifecycleStates, teams,
    canManageWorkspaces, canViewSchemas, canEditSchemas, canManageTeams,
    canViewAudit, canCreateProjects, canCreateEntities, canManageMembers,
    canManageViews,
    availableSettingsSections, defaultSettingsSection,
  ]);

  if (workspacesError || projectsError || schemasError || enumsError) {
    const error = workspacesError ?? projectsError ?? schemasError ?? enumsError;
    return (
      <AppErrorState
        fullScreen
        title="Workspace data could not be loaded"
        message="Arch Register could not load the data needed for this workspace. Reload the page to retry."
        details={error instanceof Error ? error.message : null}
        primaryAction={{ label: 'Reload page', onClick: () => window.location.reload() }}
      />
    );
  }

  if (!isLoadingWorkspaces && !ws) {
    return (
      <AppErrorState
        fullScreen
        title="Workspace not found"
        message="The requested workspace could not be resolved from the current account."
        primaryAction={{ label: 'Reload page', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className={`ar-app ${styles.shell}`}>
        <TopBar
          workspaces={workspaces}
          currentWs={ws?.id ?? ''}
          onPickWs={handlePickWs}
          trail={trail}
          query={query}
          onQueryChange={setQuery}
          onQuerySubmit={handleQuerySubmit}
          onOpenSettings={handleOpenSettings}
          onOpenGlobalSettings={handleOpenGlobalSettings}
          onAddWorkspace={() => setAddWsOpen(true)}
          onNewProject={() => setAddProjectOpen(true)}
          onNewEntity={() => setAddEntityOpen(true)}
          canOpenSettings={availableSettingsSections.length > 0}
          canOpenGlobalSettings={canManageGlobalRoles}
          canAddWorkspace={canManageWorkspaces}
          canNewProject={canCreateProjects}
          canNewEntity={canCreateEntities}
        />
        <div className={`${styles.body} ${showSidebar ? '' : styles.bodyNoSidebar}`.trim()}>
          <NavRail
            items={visibleRailItems}
            value={VIEW_TO_RAIL[activeView] ?? 'home'}
            onChange={id => { if (id !== null) handleRailPick(id); }}
          />
          {showSidebar && <SidePanel />}
          <main className={styles.main}>
            {activeView !== 'diagram' && (
              <RouteContentBoundary>
                <Outlet />
              </RouteContentBoundary>
            )}
          </main>
        </div>
        {canManageWorkspaces && (
          <AddWorkspaceDialog
            open={addWsOpen}
            onClose={() => setAddWsOpen(false)}
            onCreated={newWs => {
              void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
              navigate({ to: '/$workspaceSlug', params: { workspaceSlug: newWs.url_slug } });
            }}
          />
        )}
        {workspaceSlug && canCreateProjects && (
          <AddProjectDialog
            open={addProjectOpen}
            onClose={() => setAddProjectOpen(false)}
            onCreated={project => {
              void queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceSlug) });
              navigate({
                to: '/$workspaceSlug/projects/$projectId',
                params: { workspaceSlug, projectId: project.id },
                search: { tab: getProjectSidebarTab(project) },
              });
            }}
            workspaceId={workspaceSlug}
            teams={teams}
          />
        )}
        {workspaceSlug && canCreateEntities && (
          <AddEntityDialog
            open={addEntityOpen}
            onClose={() => setAddEntityOpen(false)}
            onCreated={entity => {
              navigate({
                to: '/$workspaceSlug/entities/$entityId',
                params: { workspaceSlug, entityId: entity._uid },
              });
            }}
            workspaceId={workspaceSlug}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            teams={teams}
            preselectedSchemaId={null}
          />
        )}
      </div>
      {activeView === 'diagram' && (
        <RouteContentBoundary>
          <Outlet />
        </RouteContentBoundary>
      )}
    </WorkspaceContext.Provider>
  );
};

const buildTrail = (
  activeView: ViewId,
  workspaceSlug: string,
  projects: Project[],
  matches: Array<{ routeId: string; params: Record<string, string> }>,
  navigate: ReturnType<typeof useNavigate>,
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: 'Home',
      icon: <TbHome size={12} />,
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }),
    },
  ];

  // Extract params from route matches
  const allParams = Object.assign({}, ...matches.map(m => m.params)) as Record<string, string>;

  switch (activeView) {
    case 'project-detail': {
      const p = projects.find(x => x.id === allParams.projectId);
      items.push({
        label: 'Projects',
        icon: <TbFolders size={12} />,
        onClick: () => {
          const def = getDefaultProject(projects);
          if (def) {
            navigate({
              to: '/$workspaceSlug/projects/$projectId',
              params: { workspaceSlug, projectId: def.id },
            });
          }
        },
      });
      if (p) items.push({ label: p.name, onClick: () => {} });
      break;
    }
    case 'entity-browser':
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } }),
      });
      break;
    case 'entity-detail':
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } }),
      });
      items.push({ label: 'Detail', onClick: () => {} });
      break;
    case 'data-model': {
      items.push({
        label: 'Data model',
        icon: <TbCode size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/model', params: { workspaceSlug } }),
      });
      // Schema name from search params would need to be read separately
      break;
    }
    case 'workspace-settings':
      items.push({
        label: 'Settings',
        icon: <TbSettings size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/settings', params: { workspaceSlug } }),
      });
      break;
    case 'global-settings':
      items.push({
        label: 'Global Settings',
        icon: <TbSettings size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/settings/global', params: { workspaceSlug } }),
      });
      break;
    case 'account-settings':
      items.push({
        label: 'Account Settings',
        icon: <TbSettings size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/account', params: { workspaceSlug } }),
      });
      break;
    case 'search':
      items.push({
        label: 'Search',
        icon: <TbSearch size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/search', params: { workspaceSlug } }),
      });
      break;
    case 'assistant':
      items.push({
        label: 'AI Assistant',
        icon: <TbSparkles size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/assistant', params: { workspaceSlug } }),
      });
      break;
    case 'extract':
      items.push({
        label: 'AI Extract',
        icon: <TbWand size={12} />,
        onClick: () => navigate({ to: '/$workspaceSlug/extract', params: { workspaceSlug } }),
      });
      break;
    case 'diagram': {
      const p = projects.find(x => x.id === allParams.projectId);
      items.push({
        label: 'Projects',
        icon: <TbFolders size={12} />,
        onClick: () => {
          const def = getDefaultProject(projects);
          if (def) {
            navigate({
              to: '/$workspaceSlug/projects/$projectId',
              params: { workspaceSlug, projectId: def.id },
            });
          }
        },
      });
      if (p) {
        items.push({
          label: p.name,
          onClick: () =>
            navigate({
              to: '/$workspaceSlug/projects/$projectId',
              params: { workspaceSlug, projectId: p.id },
            }),
        });
      }
      items.push({ label: 'Diagram', onClick: () => {} });
      break;
    }
  }

  return items;
};
