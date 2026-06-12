import { createRoute } from '@tanstack/react-router';
import { SearchScreen } from '../../sections/search/SearchScreen';
import { validateSearchSearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildSearchBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createSearchWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const route = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'search',
    validateSearch: validateSearchSearch,
    component: SearchScreen
  });

  return [
    {
      route,
      matchesRouteId: routeId => routeId.endsWith('/search'),
      buildShell: ctx => ({
        variant: 'full-bleed',
        activeRailItem: 'search',
        breadcrumbs: buildSearchBreadcrumbs(ctx)
      })
    }
  ];
};
