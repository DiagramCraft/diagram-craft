import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildBaselineBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { LazyBaselineDetailScreen, LazyBaselineListScreen } from './lazyWorkspaceScreens';

export const createBaselineWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const listRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'baselines',
      component: LazyBaselineListScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'baselines',
      breadcrumbs: buildBaselineBreadcrumbs(ctx)
    })
  );
  const detailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'baselines/$baselineId',
      component: LazyBaselineDetailScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'baselines',
      breadcrumbs: buildBaselineBreadcrumbs(ctx, true)
    })
  );
  return [listRoute, detailRoute] as const;
};
