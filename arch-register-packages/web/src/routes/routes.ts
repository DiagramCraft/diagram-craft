import {
  createRootRouteWithContext,
  createRoute,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import type { RouterContext } from '../routerContext';
import { LoginScreen } from '../screens/LoginScreen';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { WorkspaceHome } from '../screens/WorkspaceHome';
import { ProjectDetail } from '../screens/ProjectDetail';
import { DiagramScreen } from '../screens/DiagramScreen';
import { EntityBrowser } from '../screens/EntityBrowser';
import { EntityDetail } from '../screens/EntityDetail';
import { DataModelEditor } from '../screens/DataModelEditor';
import { SearchScreen } from '../screens/SearchScreen';
import { WorkspaceSettings } from '../screens/WorkspaceSettings';
import { apiFetch } from '../api';
import type { Workspace } from '../api';
import { workspaceKeys } from '../hooks/useWorkspaces';
import {
  validateEntitySearch,
  validateProjectSearch,
  validateSettingsSearch,
  validateSearchSearch,
  validateModelSearch,
} from './searchParams';

// ─── Root Route ───────────────────────────────────────────────
export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

// ─── Login Route ──────────────────────────────────────────────
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginScreen,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
});

// ─── Index Route (redirect to first workspace) ───────────────
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
    const workspaces = await context.queryClient.ensureQueryData({
      queryKey: workspaceKeys.list(),
      queryFn: () => apiFetch<Workspace[]>('/api/workspaces'),
    });
    if (workspaces.length > 0) {
      throw redirect({
        to: '/$workspaceSlug',
        params: { workspaceSlug: workspaces[0]!.url_slug },
      });
    }
  },
});

// ─── Authenticated Layout Route ──────────────────────────────
export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: Outlet,
});

// ─── Workspace Layout Route ──────────────────────────────────
export const workspaceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$workspaceSlug',
  component: WorkspaceLayout,
});

// ─── Workspace Home ──────────────────────────────────────────
export const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: WorkspaceHome,
});

// ─── Project Detail ──────────────────────────────────────────
export const projectDetailRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'projects/$projectId',
  validateSearch: validateProjectSearch,
  component: ProjectDetail,
});

// ─── Diagram (overlay) ──────────────────────────────────────
export const diagramRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'projects/$projectId/diagrams/$diagramId',
  component: DiagramScreen,
});

// ─── Entity Browser ──────────────────────────────────────────
export const entityBrowserRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'entities',
  validateSearch: validateEntitySearch,
  component: EntityBrowser,
});

// ─── Entity Detail ───────────────────────────────────────────
export const entityDetailRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'entities/$entityId',
  component: EntityDetail,
});

// ─── Data Model ──────────────────────────────────────────────
export const dataModelRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'model',
  validateSearch: validateModelSearch,
  component: DataModelEditor,
});

// ─── Search ──────────────────────────────────────────────────
export const searchRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'search',
  validateSearch: validateSearchSearch,
  component: SearchScreen,
});

// ─── Settings ────────────────────────────────────────────────
export const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'settings',
  validateSearch: validateSettingsSearch,
  component: WorkspaceSettings,
});

// ─── Route Tree ──────────────────────────────────────────────
export const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  authenticatedRoute.addChildren([
    workspaceRoute.addChildren([
      workspaceHomeRoute,
      projectDetailRoute,
      diagramRoute,
      entityBrowserRoute,
      entityDetailRoute,
      dataModelRoute,
      searchRoute,
      settingsRoute,
    ]),
  ]),
]);
