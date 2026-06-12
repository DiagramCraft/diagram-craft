import { createRoute } from '@tanstack/react-router';
import { HomeSidebar } from '../../sections/home/HomeSidebar';
import { WorkspaceHomeScreen } from '../../sections/home/WorkspaceHomeScreen';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createHomeWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const route = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: '/',
    component: WorkspaceHomeScreen
  }), ctx => ({
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
  }));

  return [route];
};
