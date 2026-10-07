import { lazy } from 'react';
import { createRoute, type AnyRoute } from '@tanstack/react-router';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import { ensureApplicationAccess } from '../applicationAccess';
import { withWorkspaceShell } from './workspaceShellRoute';

export const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

const LazyAppDashboardRouteScreen = lazy(() =>
  import('../../sections/dashboard/AppDashboardRouteScreen').then(m => ({
    default: m.AppDashboardRouteScreen
  }))
);

/**
 * Creates the workspace route for every section of `app` that declares `dashboard`, so a
 * dashboard-only section needs just an `AppDefinition.sections` entry (#3493). Access is gated by
 * `ensureApplicationAccess`; capability gating is rendered by `AppDashboardRouteScreen`.
 */
export const createDashboardSectionRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute,
  app: AppDefinition,
  sectionId: string,
  breadcrumbs: (ctx: WorkspaceShellContext) => BreadcrumbItem[]
) => {
  const section = app.sections.find(candidate => candidate.id === sectionId);
  if (!section?.dashboard) throw new Error(`${app.name} section ${sectionId} has no dashboard`);
  return withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(section.route),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          app.applicationId as Exclude<typeof app.applicationId, 'home'>
        ),
      component: () => <LazyAppDashboardRouteScreen app={app} sectionId={sectionId} />
    }),
    ctx => railSectionShell(ctx, section.id, { breadcrumbs: breadcrumbs(ctx) })
  );
};
