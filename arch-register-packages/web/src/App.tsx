import { useState, useCallback } from 'react';
import styles from './App.module.css';
import { TopBar } from './shell/TopBar';
import type { BreadcrumbItem } from './shell/TopBar';
import { NavRail } from './shell/NavRail';
import { SidePanel } from './shell/SidePanel';
import { WorkspaceHome } from './screens/WorkspaceHome';
import { EntityBrowser } from './screens/EntityBrowser';
import { EntityDetail } from './screens/EntityDetail';
import { DataModelEditor } from './screens/DataModelEditor';
import { useWorkspacePermissions } from './auth/useWorkspacePermissions';
import { ProjectDetail } from './screens/ProjectDetail';
import { SearchScreen } from './screens/SearchScreen';
import { WorkspaceSettings } from './screens/WorkspaceSettings';
import { DiagramScreen } from './screens/DiagramScreen';
import { AddWorkspaceDialog } from './components/AddWorkspaceDialog';
import { AddEntityDialog } from './components/AddEntityDialog';
import { AddProjectDialog } from './components/AddProjectDialog';
import type { Route, RoutePatch, ViewId } from './routing';
import type {
  EntitySchema,
  Project
} from './api';
import { TbHome, TbStack2, TbDatabase, TbCode, TbSearch, TbSettings } from 'react-icons/tb';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useSchemas } from './hooks/useSchemas';
import { useProjects } from './hooks/useProjects';
import { useWorkspaceConfig } from './hooks/useWorkspaceConfig';

const getProjectSidebarTab = (project: Project | undefined): Route['projectSidebarTab'] =>
  project?.status === 'archived' ? 'archive' : 'projects';

const getDefaultProjectRoute = (
  projects: Project[]
): Pick<Route, 'projectId' | 'projectSidebarTab'> => {
  const project = projects.find(candidate => candidate.status !== 'archived') ?? projects[0];
  return {
    projectId: project?.id ?? null,
    projectSidebarTab: getProjectSidebarTab(project)
  };
};

const RAIL_TO_VIEW: Record<string, ViewId> = {
  home: 'home',
  projects: 'project-detail',
  entities: 'entity-browser',
  model: 'data-model',
  search: 'search'
};

const App = () => {
  const [route, setRoute] = useState<Route>({
    view: 'home',
    workspaceId: null,
    projectId: null,
    entityId: null,
    diagramId: null,
    schemaId: null,
    projectSidebarTab: 'projects',
    typeFilter: null,
    statusFilter: null,
    ownerFilter: null,
    folderFilter: null,
    settingsSection: 'general',
    prev: null
  });
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [addWsOpen, setAddWsOpen] = useState(false);
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  // Fetch workspaces using TanStack Query
  const { data: workspaces = [] } = useWorkspaces();

  // Auto-select first workspace if none selected
  const ws = workspaces.find((w: { id: string }) => w.id === route.workspaceId) ?? workspaces[0];
  const wsId = ws?.url_slug ?? '';

  // Auto-navigate to first workspace on mount
  if (!route.workspaceId && workspaces.length > 0 && workspaces[0]) {
    setRoute(prev => ({ ...prev, workspaceId: workspaces[0]!.id }));
  }
  // Fetch workspace data using TanStack Query
  const { data: schemas = [] } = useSchemas(wsId, !!wsId);
  const { data: projects = [] } = useProjects(wsId);
  const { lifecycleStates, ownerOptions } = useWorkspaceConfig(wsId, !!wsId);

  const {
    canManageWorkspaces,
    canViewSchemas,
    canEditSchemas,
    canManageTeams,
    canViewAudit,
    canCreateProjects,
    canCreateEntities
  } = useWorkspacePermissions(ws?.id);
  const availableSettingsSections = [
    ...(canManageWorkspaces ? ['general', 'danger'] : []),
    ...(canManageTeams ? ['lifecycle-owners'] : []),
    ...(canViewAudit ? ['audit'] : [])
  ];
  const defaultSettingsSection = availableSettingsSections[0] ?? null;

  const navigate = useCallback(
    (patch: RoutePatch) =>
      setRoute(prev => ({
        ...prev,
        ...patch,
        prev: patch.view && patch.view !== prev.view ? prev : prev.prev
      })),
    []
  );

  const showSidebar = route.view !== 'search' && route.view !== 'diagram';

  const trail = buildTrail(route, navigate, schemas, projects);

  const handleRailPick = (id: string) => {
    const view = RAIL_TO_VIEW[id];
    if (!view) return;
    if (view === 'data-model' && !canViewSchemas) return;
    if (view === 'project-detail' && !route.projectId) {
      navigate({ view, ...getDefaultProjectRoute(projects) });
    } else {
      navigate({ view });
    }
  };

  let screen: React.ReactNode;
  let diagramOverlay: React.ReactNode = null;
  switch (route.view) {
    case 'home':
      screen = ws ? (
        <WorkspaceHome
          workspace={ws}
          schemas={schemas}
          projects={projects}
          navigate={navigate}
          onAddProject={canCreateProjects ? () => setAddProjectOpen(true) : undefined}
          onAddEntity={canCreateEntities ? () => setAddEntityOpen(true) : undefined}
          canViewAudit={canViewAudit}
          canViewSchemas={canViewSchemas}
          canEditSchemas={canEditSchemas}
        />
      ) : null;
      break;
    case 'project-detail':
      screen =
        wsId && route.projectId ? (
          <ProjectDetail
            workspaceId={wsId}
            projectId={route.projectId}
            folderFilter={route.folderFilter}
            navigate={navigate}
            onProjectUpdated={() => {}}
            ownerOptions={ownerOptions}
          />
        ) : null;
      break;
    case 'entity-browser':
      screen = wsId ? (
        <EntityBrowser
          workspaceId={wsId}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          typeFilter={route.typeFilter}
          statusFilter={route.statusFilter}
          ownerFilter={route.ownerFilter}
          navigate={navigate}
          onAddEntity={canCreateEntities ? () => setAddEntityOpen(true) : undefined}
        />
      ) : null;
      break;
    case 'entity-detail':
      screen =
        wsId && route.entityId ? (
          <EntityDetail
            workspaceId={wsId}
            entityId={route.entityId}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            ownerOptions={ownerOptions}
            navigate={navigate}
            canViewAudit={canViewAudit}
          />
        ) : null;
      break;
    case 'data-model':
      screen = wsId ? (
        <DataModelEditor
          workspaceId={wsId}
          schemas={schemas}
          selectedSchemaId={route.schemaId}
          onSelectSchema={id => navigate({ schemaId: id })}
          onSchemaUpdated={() => {}}
          canEdit={canEditSchemas}
        />
      ) : null;
      break;
    case 'search':
      screen = wsId ? (
        <SearchScreen
          workspaceId={wsId}
          query={submittedQuery}
          schemas={schemas}
          navigate={navigate}
          onQueryChange={setQuery}
          onQuerySubmit={q => {
            const trimmed = q.trim();
            setSubmittedQuery(trimmed);
            setQuery(trimmed);
          }}
        />
      ) : null;
      break;
    case 'workspace-settings':
      screen = ws ? (
        <WorkspaceSettings
          workspace={ws}
          section={
            availableSettingsSections.includes(route.settingsSection)
              ? route.settingsSection
              : (defaultSettingsSection ?? route.settingsSection)
          }
          navigate={navigate}
          onWorkspaceUpdated={() => {}}
          onWorkspaceDeleted={() => {}}
          lifecycleStates={lifecycleStates}
          ownerOptions={ownerOptions}
          onConfigUpdated={() => {}}
          availableSections={availableSettingsSections}
        />
      ) : null;
      break;
    case 'diagram':
      diagramOverlay =
        wsId && route.projectId && route.diagramId ? (
          <DiagramScreen
            workspaceId={wsId}
            projectId={route.projectId}
            diagramId={route.diagramId}
            navigate={navigate}
          />
        ) : null;
      break;
    default:
      screen = <div className={styles.placeholder}>{route.view} — coming soon</div>;
  }

  return (
    <>
      <div className={`ar-app ${styles.shell}`}>
        <TopBar
          workspaces={workspaces}
          currentWs={route.workspaceId ?? ''}
          onPickWs={id => navigate({ workspaceId: id })}
          trail={trail}
          query={query}
          onQueryChange={setQuery}
          onQuerySubmit={nextQuery => {
            const trimmed = nextQuery.trim();
            setSubmittedQuery(trimmed);
            if (trimmed !== '') {
              navigate({ view: 'search' });
            }
          }}
          onOpenSettings={() => {
            if (defaultSettingsSection) {
              navigate({ view: 'workspace-settings', settingsSection: defaultSettingsSection });
            }
          }}
          onAddWorkspace={() => setAddWsOpen(true)}
          canOpenSettings={availableSettingsSections.length > 0}
          canAddWorkspace={canManageWorkspaces}
        />
        <div className={`${styles.body} ${showSidebar ? '' : styles.bodyNoSidebar}`.trim()}>
          <NavRail
            view={route.view}
            onPick={handleRailPick}
            visibleItemIds={canViewSchemas ? undefined : ['home', 'projects', 'entities', 'search']}
          />
          {showSidebar && (
            <SidePanel
              view={route.view}
              navigate={navigate}
              schemas={schemas}
              projects={projects}
              lifecycleStates={lifecycleStates}
              workspace={ws ?? null}
              workspaceId={wsId ?? null}
              projectId={route.projectId}
              projectSidebarTab={route.projectSidebarTab}
              schemaId={route.schemaId}
              folderFilter={route.folderFilter}
              typeFilter={route.typeFilter}
              statusFilter={route.statusFilter}
              ownerFilter={route.ownerFilter}
              settingsSection={route.settingsSection}
              availableSettingsSections={availableSettingsSections}
              setProjectSidebarTab={tab => navigate({ projectSidebarTab: tab })}
              setTypeFilter={id => navigate({ typeFilter: id })}
              setStatusFilter={id => navigate({ statusFilter: id })}
              setOwnerFilter={id => navigate({ ownerFilter: id })}
            />
          )}
          <main className={styles.main}>{screen}</main>
        </div>
        {canManageWorkspaces && (
          <AddWorkspaceDialog
            open={addWsOpen}
            onClose={() => setAddWsOpen(false)}
            onCreated={newWs => {
              navigate({ workspaceId: newWs.id });
            }}
          />
        )}
        {wsId && canCreateProjects && (
          <AddProjectDialog
            open={addProjectOpen}
            onClose={() => setAddProjectOpen(false)}
            onCreated={project => {
              navigate({
                view: 'project-detail',
                projectId: project.id,
                projectSidebarTab: getProjectSidebarTab(project)
              });
            }}
            workspaceId={wsId}
            ownerOptions={ownerOptions}
          />
        )}
        {wsId && canCreateEntities && (
          <AddEntityDialog
            open={addEntityOpen}
            onClose={() => setAddEntityOpen(false)}
            onCreated={entity => {
              navigate({ view: 'entity-detail', entityId: entity._uid });
            }}
            workspaceId={wsId}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            ownerOptions={ownerOptions}
            preselectedSchemaId={route.typeFilter}
          />
        )}
      </div>
      {diagramOverlay}
    </>
  );
};

const buildTrail = (
  route: Route,
  navigate: (p: RoutePatch) => void,
  schemas: EntitySchema[],
  projects: Project[]
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: 'Home',
      icon: <TbHome size={12} />,
      onClick: () => navigate({ view: 'home' })
    }
  ];

  switch (route.view) {
    case 'project-detail': {
      const p = projects.find(x => x.id === route.projectId);
      items.push({
        label: 'Projects',
        icon: <TbStack2 size={12} />,
        onClick: () => navigate({ view: 'project-detail', ...getDefaultProjectRoute(projects) })
      });
      if (p) items.push({ label: p.name, onClick: () => {} });
      break;
    }
    case 'entity-browser':
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ view: 'entity-browser' })
      });
      break;
    case 'entity-detail': {
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ view: 'entity-browser' })
      });
      items.push({ label: 'Detail', onClick: () => {} });
      break;
    }
    case 'data-model': {
      items.push({
        label: 'Data model',
        icon: <TbCode size={12} />,
        onClick: () => navigate({ view: 'data-model', schemaId: null })
      });
      if (route.schemaId) {
        const s = schemas.find(x => x.id === route.schemaId);
        if (s) items.push({ label: s.name, onClick: () => {} });
      }
      break;
    }
    case 'workspace-settings':
      items.push({
        label: 'Settings',
        icon: <TbSettings size={12} />,
        onClick: () => navigate({ view: 'workspace-settings' })
      });
      break;
    case 'search':
      items.push({
        label: 'Search',
        icon: <TbSearch size={12} />,
        onClick: () => navigate({ view: 'search' })
      });
      break;
    case 'diagram': {
      const p = projects.find(x => x.id === route.projectId);
      items.push({
        label: 'Projects',
        icon: <TbStack2 size={12} />,
        onClick: () => navigate({ view: 'project-detail', ...getDefaultProjectRoute(projects) })
      });
      if (p) {
        items.push({
          label: p.name,
          onClick: () => navigate({ view: 'project-detail', projectId: p.id })
        });
      }
      items.push({ label: 'Diagram', onClick: () => {} });
      break;
    }
  }

  return items;
};

export default App;
