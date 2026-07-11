import { useState, useCallback, useMemo } from 'react';
import { Outlet, useParams, useNavigate, useMatches, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import styles from './WorkspaceLayout.module.css';
import sidePanelStyles from '../shell/SidePanel.module.css';
import { TopBar } from '../shell/TopBar';
import { NavRail, type NavRailItem } from '@diagram-craft/app-components/NavRail';
import { AddWorkspaceDialog } from '../dialogs/AddWorkspaceDialog';
import { AddEntityDialog } from '../dialogs/AddEntityDialog';
import { AddProjectDialog } from '../dialogs/AddProjectDialog';
import { useWorkspaces, workspaceKeys } from '../hooks/useWorkspaces';
import { projectKeys } from '../hooks/queryKeys';
import { useSchemas } from '../hooks/useSchemas';
import { useEnums } from '../hooks/useEnums';
import { useProjects } from '../hooks/useProjects';
import { useWorkspaceConfig } from '../hooks/useWorkspaceConfig';
import { useAiConfig } from '../hooks/useAiConfig';
import { useWorkspacePermissions } from '../auth/useWorkspacePermissions';
import { useAuthorizationData } from '../auth/AuthorizationDataContext';
import { WorkspaceContext } from './WorkspaceContext';
import { RouteContentBoundary } from '../routes/RouteContentBoundary';
import { AppErrorState } from '../components/AppErrorState';
import {
  TbDatabase,
  TbFileAi,
  TbFiles,
  TbFolders,
  TbHome,
  TbMessageCircleStar,
  TbSearch
} from 'react-icons/tb';
import { WorkspaceDetailLayout } from './WorkspaceDetailLayout';
import { navigateFromRailItem, resolveWorkspaceShellDescriptor } from './workspaceShellDescriptors';
import type { WorkspaceRailItemId } from '../shell/shellTypes';
import { getWorkspaceShellBuilder } from '../routes/workspace/workspaceShellRoute';
import { settingsSectionTarget } from '../routes/settingsNavigation';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../routes/publicObjectRoutes';

const ALL_RAIL_ITEMS: NavRailItem[] = [
  { id: 'home', icon: TbHome, tooltip: 'Workspace overview' },
  { id: 'content', icon: TbFiles, tooltip: 'Workspace content' },
  { id: 'projects', icon: TbFolders, tooltip: 'Projects' },
  { id: 'entities', icon: TbDatabase, tooltip: 'Entities' },
  { id: 'search', icon: TbSearch, tooltip: 'Search' },
  { id: 'assistant', icon: TbMessageCircleStar, tooltip: 'AI Assistant', separator: true },
  { id: 'extract', icon: TbFileAi, tooltip: 'AI Extract' }
];

export const WorkspaceLayout = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const matches = useMatches();

  const [query, setQuery] = useState('');
  const [addWsOpen, setAddWsOpen] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const {
    data: workspaces = [],
    error: workspacesError,
    isLoading: isLoadingWorkspaces
  } = useWorkspaces();
  const ws = workspaces.find(w => w.url_slug === workspaceSlug) ?? null;

  const { data: schemas = [], error: schemasError } = useSchemas(workspaceSlug, !!workspaceSlug);
  const { data: enums = [], error: enumsError } = useEnums(workspaceSlug, !!workspaceSlug);
  const { data: projects = [], error: projectsError } = useProjects(workspaceSlug);
  const { lifecycleStates, teams, projectEntityTypes } = useWorkspaceConfig(
    workspaceSlug,
    !!workspaceSlug
  );
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
    canManageAdminViews
  } = useWorkspacePermissions(ws?.id);

  // Get global permissions separately for the global settings link
  const authData = useAuthorizationData();
  const canManageGlobalRoles =
    authData?.global_permissions?.includes('manage_workspace_roles') ?? false;

  const availableSettingsSections = useMemo(
    () => [
      ...(canManageWorkspaces ? ['general', 'danger', 'export-import'] : []),
      ...(canManageTeams ? ['lifecycle-owners', 'teams'] : []),
      ...(canViewSchemas ? ['model-overview', 'schemas'] : []),
      ...(canManageMembers ? ['roles', 'members'] : []),
      ...(canManageWorkspaces ? ['ai'] : []),
      ...(canViewAudit ? ['analytics', 'audit'] : [])
    ],
    [canManageWorkspaces, canManageTeams, canViewSchemas, canManageMembers, canViewAudit]
  );

  const defaultSettingsSection = availableSettingsSections[0] ?? null;

  const handleRailPick = useCallback(
    (id: WorkspaceRailItemId) => {
      navigateFromRailItem(id, { navigate, workspaceSlug, projects });
    },
    [navigate, projects, workspaceSlug]
  );

  const handlePickWs = useCallback(
    (wsId: string) => {
      const target = workspaces.find(w => w.id === wsId);
      if (target) {
        navigate({ to: '/$workspaceSlug', params: { workspaceSlug: target.url_slug } });
      }
    },
    [navigate, workspaces]
  );

  const handleQuerySubmit = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim();
      if (trimmed !== '') {
        navigate({
          to: '/$workspaceSlug/search',
          params: { workspaceSlug },
          search: { q: trimmed }
        });
      }
    },
    [navigate, workspaceSlug]
  );

  const handleOpenSettings = useCallback(() => {
    if (defaultSettingsSection) {
      navigate(settingsSectionTarget(workspaceSlug, defaultSettingsSection));
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
    return ALL_RAIL_ITEMS.filter(
      item => aiEnabled || (item.id !== 'assistant' && item.id !== 'extract')
    );
  }, [aiConfig?.enabled]);

  const contextValue = useMemo(
    () => ({
      workspace: ws,
      workspaceSlug,
      schemas,
      enums,
      projects,
      lifecycleStates,
      teams,
      projectEntityTypes,
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
        canManageAdminViews
      },
      availableSettingsSections,
      defaultSettingsSection,
      openAddProjectDialog: () => setAddProjectOpen(true),
      openAddEntityDialog: () => setAddEntityOpen(true)
    }),
    [
      ws,
      workspaceSlug,
      schemas,
      enums,
      projects,
      lifecycleStates,
      teams,
      projectEntityTypes,
      canManageWorkspaces,
      canViewSchemas,
      canEditSchemas,
      canManageTeams,
      canViewAudit,
      canCreateProjects,
      canCreateEntities,
      canManageMembers,
      canManageViews,
      canManageAdminViews,
      availableSettingsSections,
      defaultSettingsSection
    ]
  );

  const shellDescriptor = resolveWorkspaceShellDescriptor({
    matches: matches.map(match => ({
      routeId: match.routeId,
      params: match.params as Record<string, string>,
      buildShell: getWorkspaceShellBuilder(router.routesById[match.routeId])
    })),
    navigate,
    workspace: ws,
    workspaceSlug,
    schemas,
    enums,
    projects,
    lifecycleStates,
    teams,
    availableSettingsSections
  });

  const navRail = (
    <NavRail
      items={visibleRailItems}
      value={shellDescriptor.variant === 'overlay' ? null : shellDescriptor.activeRailItem}
      onChange={id => {
        if (id !== null) handleRailPick(id as WorkspaceRailItemId);
      }}
    />
  );

  const routeContent = (
    <RouteContentBoundary>
      <Outlet />
    </RouteContentBoundary>
  );

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
      {shellDescriptor.variant === 'overlay' ? (
        routeContent
      ) : (
        <div className={`ar-app ${styles.shell}`}>
          <TopBar
            workspaces={workspaces}
            currentWs={ws?.id ?? ''}
            workspaceSlug={workspaceSlug}
            onPickWs={handlePickWs}
            trail={shellDescriptor.breadcrumbs}
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
            hideSearch={shellDescriptor.hideSearch}
            hideWorkspaceSwitcher={shellDescriptor.hideWorkspaceSwitcher}
          />
          {shellDescriptor.variant === 'detail' ? (
            <WorkspaceDetailLayout
              rail={navRail}
              navigationLabel={shellDescriptor.navigationLabel}
              renderNavigation={shellDescriptor.renderNavigation}
              secondarySidebar={shellDescriptor.secondarySidebar}
            >
              {routeContent}
            </WorkspaceDetailLayout>
          ) : (
            <div
              className={[styles.body, shellDescriptor.primarySidebar ? '' : styles.bodyNoSidebar]
                .filter(Boolean)
                .join(' ')}
            >
              {navRail}
              {shellDescriptor.primarySidebar && (
                <div className={sidePanelStyles.panel}>{shellDescriptor.primarySidebar}</div>
              )}
              <main className={styles.main}>{routeContent}</main>
            </div>
          )}
        </div>
      )}
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
            navigate(
              projectDetailRoute(workspaceSlug, asProjectPublicId(project.public_id), {
                tab:
                  project.status === 'complete' || project.status === 'cancelled'
                    ? 'archive'
                    : 'projects',
                section: 'home'
              })
            );
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
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)));
          }}
          workspaceId={workspaceSlug}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams}
          preselectedSchemaId={null}
        />
      )}
    </WorkspaceContext.Provider>
  );
};
