import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routes/routes';
import { queryClient } from './lib/queryClient';
import type { RouterContext } from './routerContext';
import { RoutePendingComponent } from './routes/RoutePendingComponent';

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: {
      isAuthenticated: false,
      isLoading: true
    }
  } satisfies RouterContext,
  defaultPreload: 'intent',
  defaultPendingComponent: RoutePendingComponent,
  defaultPendingMs: 150,
  defaultPendingMinMs: 300
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
