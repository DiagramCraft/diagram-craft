import { useState, useCallback } from 'react';
import styles from './App.module.css';
import { TopBar } from './shell/TopBar';
import type { BreadcrumbItem } from './shell/TopBar';
import { NavRail } from './shell/NavRail';
import { SidePanel } from './shell/SidePanel';
import { WorkspaceHome } from './screens/WorkspaceHome';
import { WORKSPACES, PROJECTS, ENTITIES } from './data';
import type { Route, RoutePatch, ViewId } from './routing';
import { TbHome, TbStack2, TbDatabase, TbCode, TbSearch, TbSettings } from 'react-icons/tb';

const DEFAULT_ROUTE: Route = {
  view: 'home',
  workspaceId: 'ws-commerce',
  projectId: null,
  entityId: null,
  diagramId: null,
  typeFilter: null,
  settingsSection: 'general',
  prev: null,
};

const RAIL_TO_VIEW: Record<string, ViewId> = {
  home: 'home',
  projects: 'project-detail',
  entities: 'entity-browser',
  model: 'data-model',
  search: 'search',
};

const App = () => {
  const [route, setRoute] = useState<Route>(DEFAULT_ROUTE);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const navigate = useCallback(
    (patch: RoutePatch) =>
      setRoute(prev => ({
        ...prev,
        ...patch,
        prev: patch.view && patch.view !== prev.view ? prev : prev.prev,
      })),
    [],
  );

  const ws = WORKSPACES.find(w => w.id === route.workspaceId) ?? WORKSPACES[0];

  const trail = buildTrail(route, navigate);

  const handleRailPick = (id: string) => {
    const view = RAIL_TO_VIEW[id];
    if (!view) return;
    if (view === 'project-detail' && !route.projectId) {
      navigate({ view, projectId: PROJECTS[0]?.id ?? null });
    } else {
      navigate({ view });
    }
  };

  let screen: React.ReactNode;
  switch (route.view) {
    case 'home':
      screen = <WorkspaceHome workspace={ws} navigate={navigate} />;
      break;
    default:
      screen = (
        <div className={styles.placeholder}>
          {route.view} — coming soon
        </div>
      );
  }

  return (
    <div className={styles.shell}>
      <TopBar
        workspaces={WORKSPACES}
        currentWs={route.workspaceId}
        onPickWs={id => navigate({ workspaceId: id })}
        trail={trail}
        query={query}
        onQuery={setQuery}
        onOpenSettings={() => navigate({ view: 'workspace-settings' })}
      />
      <div className={styles.body}>
        <NavRail view={route.view} onPick={handleRailPick} />
        <SidePanel
          view={route.view}
          navigate={navigate}
          projectId={route.projectId}
          typeFilter={route.typeFilter}
          setTypeFilter={id => navigate({ typeFilter: id })}
          expanded={expanded}
          setExpanded={setExpanded}
        />
        <main className={styles.main}>{screen}</main>
      </div>
    </div>
  );
};

const buildTrail = (route: Route, navigate: (p: RoutePatch) => void): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    {
      label: 'Home',
      icon: <TbHome size={12} />,
      onClick: () => navigate({ view: 'home' }),
    },
  ];

  switch (route.view) {
    case 'project-detail': {
      const p = PROJECTS.find(x => x.id === route.projectId);
      items.push({
        label: 'Projects',
        icon: <TbStack2 size={12} />,
        onClick: () => navigate({ view: 'project-detail', projectId: PROJECTS[0]?.id ?? null }),
      });
      if (p) items.push({ label: p.name, onClick: () => {} });
      break;
    }
    case 'entity-browser':
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ view: 'entity-browser' }),
      });
      break;
    case 'entity-detail': {
      const e = ENTITIES.find(x => x.id === route.entityId);
      items.push({
        label: 'Entities',
        icon: <TbDatabase size={12} />,
        onClick: () => navigate({ view: 'entity-browser' }),
      });
      if (e) items.push({ label: e.name, onClick: () => {} });
      break;
    }
    case 'data-model':
      items.push({
        label: 'Data model',
        icon: <TbCode size={12} />,
        onClick: () => navigate({ view: 'data-model' }),
      });
      break;
    case 'workspace-settings':
      items.push({
        label: 'Settings',
        icon: <TbSettings size={12} />,
        onClick: () => navigate({ view: 'workspace-settings' }),
      });
      break;
    case 'search':
      items.push({
        label: 'Search',
        icon: <TbSearch size={12} />,
        onClick: () => navigate({ view: 'search' }),
      });
      break;
  }

  return items;
};

export default App;
