import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { validateSearchSearch } from '../searchParams';
import { buildSearchBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { LazySearchScreen } from './lazyWorkspaceScreens';

export const createSearchWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'search',
      validateSearch: validateSearchSearch,
      component: LazySearchScreen
    }),
    ctx => ({
      variant: 'full-bleed',
      activeRailItem: 'search',
      breadcrumbs: buildSearchBreadcrumbs(ctx)
    })
  );

  return [route] as const;
};
