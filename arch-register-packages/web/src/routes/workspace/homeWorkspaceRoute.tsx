import { createRoute } from '@tanstack/react-router';
import { HomeSidebar } from '../../sections/home/HomeSidebar';
import { WorkspaceHomeScreen } from '../../sections/home/WorkspaceHomeScreen';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createHomeWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const route = createRoute({
    getParentRoute: () => workspaceRoute,
    path: '/',
    component: WorkspaceHomeScreen
  });

  return [
    {
      route,
      matchesRouteId: routeId =>
        routeId === '/authenticated/$workspaceSlug/' || routeId === '/authenticated/$workspaceSlug',
      buildShell: ctx => ({
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
    }
  ];
};
