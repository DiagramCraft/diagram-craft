import {
  createRootRouteWithContext,
  createRoute,
  redirect,
} from '@tanstack/react-router';
import type { RouterContext } from '../routerContext';
import { LoginScreen } from '../auth/LoginScreen';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { WorkspaceHomeScreen } from '../sections/home/WorkspaceHomeScreen';
import { ProjectDetailScreen } from '../sections/projects/ProjectDetailScreen';
import { DiagramScreen } from '../sections/projects/DiagramScreen';
import { EntityBrowserScreen } from '../sections/entities/EntityBrowserScreen';
import { EntityDetailScreen } from '../sections/entities/EntityDetailScreen';
import { DataModelEditorScreen } from '../sections/data-model/DataModelEditorScreen';
import { SearchScreen } from '../sections/search/SearchScreen';
import { WorkspaceSettingsScreen } from '../sections/workspace-settings/WorkspaceSettingsScreen';
import { GlobalSettingsScreen } from '../sections/global-settings/GlobalSettingsScreen';
import { AccountSettingsScreen } from '../sections/account-settings/AccountSettingsScreen';
import { AssistantScreen } from '../sections/ai-assistant/AssistantScreen';
import { ExtractScreen } from '../sections/ai-extract/ExtractScreen';
import { apiFetch } from '../api';
import type { Workspace } from '../api';
import { workspaceKeys } from '../hooks/useWorkspaces';
import { ImportScreen } from '../sections/entities/ImportScreen';

import {
  validateEntitySearch,
  validateProjectSearch,
  validateSettingsSearch,
  validateSearchSearch,
  validateModelSearch,
  validateAssistantSearch,
} from './searchParams';
import { RootLayout } from '../layouts/RootLayout';
import { RouteErrorComponent } from './RouteErrorComponent';

// ─── Root Route ───────────────────────────────────────────────
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RouteErrorComponent,
});

// ─── Login Route ──────────────────────────────────────────────
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginScreen,
  validateSearch: (search: Record<string, unknown>) => {
    const redirect = search.redirect as string | undefined;
    const reason = search.reason === 'session-expired' ? 'session-expired' : undefined;
    return {
      ...(redirect ? { redirect } : {}),
      ...(reason ? { reason } : {}),
    };
  },
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      // If user is already authenticated and there's a redirect param, go there
      if (search.redirect) {
        throw redirect({ to: search.redirect });
      }
      throw redirect({ to: '/' });
    }
  },
});

// ─── Index Route (redirect to first workspace) ───────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: {} as { redirect?: string } });
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
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // Preserve the current path to redirect back after login
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: RootLayout,
  errorComponent: RouteErrorComponent,
});

// ─── Workspace Layout Route ──────────────────────────────────
const workspaceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$workspaceSlug',
  component: WorkspaceLayout,
});

// ─── Workspace Home ──────────────────────────────────────────
const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: WorkspaceHomeScreen,
});

// ─── Project Detail ──────────────────────────────────────────
const projectDetailRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'projects/$projectId',
  validateSearch: validateProjectSearch,
  component: ProjectDetailScreen,
});

// ─── Diagram (overlay) ──────────────────────────────────────
const diagramRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'projects/$projectId/diagrams/$diagramId',
  component: DiagramScreen,
});

// ─── Entity Browser ──────────────────────────────────────────
const entityBrowserRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'entities',
  validateSearch: validateEntitySearch,
  component: EntityBrowserScreen,
});

// ─── Entity Detail ───────────────────────────────────────────
const entityDetailRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'entities/$entityId',
  component: EntityDetailScreen,
});

// ─── Data Model ──────────────────────────────────────────────
const dataModelRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'model',
  validateSearch: validateModelSearch,
  component: DataModelEditorScreen,
});

// ─── Search ──────────────────────────────────────────────────
const searchRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'search',
  validateSearch: validateSearchSearch,
  component: SearchScreen,
});

// ─── Settings ────────────────────────────────────────────────
const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'settings',
  validateSearch: validateSettingsSearch,
  component: WorkspaceSettingsScreen,
});

// ─── Global Settings ─────────────────────────────────────────
const globalSettingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'settings/global',
  component: GlobalSettingsScreen,
});

// ─── Account Settings ────────────────────────────────────────
const accountSettingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'account',
  component: AccountSettingsScreen,
});

// ─── AI Assistant ───────────────────────────────────────────
const assistantRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'assistant',
  validateSearch: validateAssistantSearch,
  component: AssistantScreen,
});

// ─── AI Extract ─────────────────────────────────────────────
const extractRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'extract',
  component: ExtractScreen,
});

// ─── CSV Import ─────────────────────────────────────────────
const importRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: 'entities/import',
  component: ImportScreen,
  validateSearch: validateEntitySearch,
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
      globalSettingsRoute,
      accountSettingsRoute,
      assistantRoute,
      extractRoute,
      importRoute,
    ]),
  ]),
]);
