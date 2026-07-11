import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { SearchScreen } from '../../sections/search/SearchScreen';
import { validateSearchSearch } from '../searchParams';
import { buildSearchBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createSearchWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'search',
    validateSearch: validateSearchSearch,
    component: SearchScreen
  }), ctx => ({
    variant: 'full-bleed',
    activeRailItem: 'search',
    breadcrumbs: buildSearchBreadcrumbs(ctx)
  }));

  return [route] as const;
};
