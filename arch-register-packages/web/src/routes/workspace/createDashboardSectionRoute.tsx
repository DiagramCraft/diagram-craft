import { lazy } from 'react';
import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import type { WorkspaceApplicationWithDashboards } from '@arch-register/api-types/applicationContract';
import type { BreadcrumbItem } from '../../shell/shellTypes';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import { getAppDefinition, getRailSection } from '../../shell/appShellRegistry';
import { getAllParams, railSectionShell } from '../../layouts/workspaceShellDescriptors';
import { ensureApplicationAccess } from '../applicationAccess';
import { workspaceApplicationsQuery } from '../../queries/application';
import { withWorkspaceShell } from './workspaceShellRoute';

const LazyAppDashboardRouteScreen = lazy(() =>
  import('../../sections/dashboard/AppDashboardRouteScreen').then(m => ({
    default: m.AppDashboardRouteScreen
  }))
);

/**
 * The generic routes of every workspace application: `apps/$appKey/$dashboardId` renders one of the
 * application's dashboards, and `apps/$appKey` redirects to its first dashboard. Applications and
 * their dashboards are fetched (`workspaceApplicationsQuery`), so adding one needs no code. Access
 * is gated by `ensureApplicationAccess`.
 */
export const createApplicationWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const dashboardRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'apps/$appKey/$dashboardId',
      // No `validateSearch`: the accepted search params are the dashboard sidebar's variable names,
      // which are only known once the dashboard is loaded (see `computeSidebarVariables`).
      beforeLoad: async ({ context, params }) => {
        const { workspaceSlug, appKey } = params as unknown as {
          workspaceSlug: string;
          appKey: string;
        };
        await context.queryClient.ensureQueryData(workspaceApplicationsQuery(workspaceSlug));
        await ensureApplicationAccess(context.queryClient, workspaceSlug, appKey);
      },
      component: () => <LazyAppDashboardRouteScreen />
    }),
    ctx => {
      const { appKey, dashboardId } = getAllParams(ctx.matches);
      const app = getAppDefinition(ctx.apps, appKey!);
      const section = getRailSection(ctx.apps, dashboardId!);
      const breadcrumbs: BreadcrumbItem[] = [
        ...buildHomeBreadcrumbs(ctx),
        {
          label: section?.tooltip ?? app.name,
          onClick: () =>
            ctx.navigate({
              to: '/$workspaceSlug/apps/$appKey/$dashboardId',
              params: {
                workspaceSlug: ctx.workspaceSlug,
                appKey: appKey!,
                dashboardId: dashboardId!
              }
            })
        }
      ];
      return railSectionShell(ctx, dashboardId!, { breadcrumbs });
    }
  );

  const appIndexRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'apps/$appKey',
    beforeLoad: async ({ context, params }) => {
      const { workspaceSlug, appKey } = params as unknown as {
        workspaceSlug: string;
        appKey: string;
      };
      const applications: WorkspaceApplicationWithDashboards[] =
        await context.queryClient.ensureQueryData(workspaceApplicationsQuery(workspaceSlug));
      await ensureApplicationAccess(context.queryClient, workspaceSlug, appKey);
      const first = [...(applications.find(app => app.key === appKey)?.dashboards ?? [])].sort(
        (a, b) => a.order - b.order
      )[0];
      if (!first) throw redirect({ to: '/$workspaceSlug', params: { workspaceSlug } });
      throw redirect({
        to: '/$workspaceSlug/apps/$appKey/$dashboardId',
        params: { workspaceSlug, appKey, dashboardId: first.id }
      });
    }
  });

  return [dashboardRoute, appIndexRoute] as const;
};
