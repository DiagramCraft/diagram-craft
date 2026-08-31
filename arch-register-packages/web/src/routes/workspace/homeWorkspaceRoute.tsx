import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { HomeSidebar } from '../../sections/home/HomeSidebar';
import { DashboardScreen } from '../../sections/dashboard/DashboardScreen';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import { withWorkspaceShell } from './workspaceShellRoute';
import { validateHomeSearch } from '../searchParams';

export const createHomeWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: '/',
      validateSearch: validateHomeSearch,
      component: DashboardScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'home',
      breadcrumbs: buildHomeBreadcrumbs(ctx),
      primarySidebar: (
        <HomeSidebar
          schemas={ctx.schemas}
          projects={ctx.projects}
          workspaceSlug={ctx.workspaceSlug}
        />
      )
    })
  );

  return [route] as const;
};
