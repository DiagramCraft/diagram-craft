import { createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router';
import type { RouterContext } from '../routerContext';
import { LoginScreen } from '../auth/LoginScreen';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { workspacesQueryOptions } from '../hooks/useWorkspaces';
import { RootLayout } from '../layouts/RootLayout';
import { RouteErrorComponent } from './RouteErrorComponent';
import { createWorkspaceRouteEntries } from './workspace/createWorkspaceRouteEntries';

// ─── Root Route ───────────────────────────────────────────────
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RouteErrorComponent
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
      ...(reason ? { reason } : {})
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
  }
});

// ─── Index Route (redirect to first workspace) ───────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: {} as { redirect?: string } });
    }
    const workspaces = await context.queryClient.ensureQueryData(workspacesQueryOptions());
    if (workspaces.length > 0) {
      throw redirect({
        to: '/$workspaceSlug',
        params: { workspaceSlug: workspaces[0]!.url_slug }
      });
    }
  }
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
          redirect: location.href
        }
      });
    }
  },
  component: RootLayout,
  errorComponent: RouteErrorComponent
});

// ─── Workspace Layout Route ──────────────────────────────────
const workspaceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$workspaceSlug',
  component: WorkspaceLayout
});

const workspaceRouteEntries = createWorkspaceRouteEntries(workspaceRoute);

// ─── Route Tree ──────────────────────────────────────────────
export const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  authenticatedRoute.addChildren([workspaceRoute.addChildren(workspaceRouteEntries)])
]);
