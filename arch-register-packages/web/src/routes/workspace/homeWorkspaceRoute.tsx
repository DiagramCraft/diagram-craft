import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { HomeSidebar } from '../../sections/home/HomeSidebar';
import { WorkspaceHomeScreen } from '../../sections/home/WorkspaceHomeScreen';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createHomeWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: '/',
      component: WorkspaceHomeScreen
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
