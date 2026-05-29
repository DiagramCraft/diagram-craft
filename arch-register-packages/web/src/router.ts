import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routes/routes';
import { queryClient } from './lib/queryClient';
import type { RouterContext } from './routerContext';

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: {
      isAuthenticated: false,
      isLoading: true,
    },
  } satisfies RouterContext,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
