import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import {
  apiIntegrationCatalogAppDefinition,
  buildApiIntegrationCatalogBreadcrumbs
} from './apiIntegrationCatalogShell';
import {
  IC_OVERVIEW_ID,
  IC_APIS_ID,
  IC_INTEGRATIONS_ID,
  IC_IMPACT_ID,
  IC_RAIL_PATHS
} from './apiIntegrationCatalogSections';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyApiIntegrationCatalogOverviewDashboard,
  LazyApiIntegrationCatalogImpactDashboard
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';
import { createDashboardSectionRoute } from '../../routes/workspace/createDashboardSectionRoute';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

/**
 * API & Integration Catalog's workspace routes: one per rail section, every one a dashboard (APIs
 * and Integrations through `createDashboardSectionRoute`; their sidebar facets are untyped search
 * params, so no `validateSearch`), plus a legacy redirect from the old `apis/$apiId` deep link.
 * Mirrors `../vendor-management/vendorManagementWorkspaceRoute.tsx`.
 */
export const createApiIntegrationCatalogWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  // The app's landing route (`/$workspaceSlug/api-integration-catalog`, exact). It is
  // `apiIntegrationCatalogAppDefinition.sections[0]`, so `appRootRoute` opens here from the app
  // switcher.
  const overviewRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(IC_RAIL_PATHS[IC_OVERVIEW_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogOverviewDashboard
    }),
    ctx =>
      railSectionShell(ctx, IC_OVERVIEW_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_OVERVIEW_ID)
      })
  );
  const apisRoute = createDashboardSectionRoute(
    workspaceRoute,
    apiIntegrationCatalogAppDefinition,
    IC_APIS_ID,
    ctx => buildApiIntegrationCatalogBreadcrumbs(ctx, IC_APIS_ID)
  );
  // Legacy deep link: the APIs dashboard opens the API drawer via the shared
  // `drawer` search param (see useEntityDrawer.ts) instead of an `$apiId` route, so an old
  // bookmarked `.../apis/$apiId` URL is redirected to the equivalent search param.
  const apisDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: `${railPath(IC_RAIL_PATHS[IC_APIS_ID])}/$apiId`,
    beforeLoad: ({ params }) => {
      const { workspaceSlug, apiId } = params as unknown as {
        workspaceSlug: string;
        apiId: string;
      };
      throw redirect({
        to: IC_RAIL_PATHS[IC_APIS_ID],
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: apiId })
      });
    }
  });
  const integrationsRoute = createDashboardSectionRoute(
    workspaceRoute,
    apiIntegrationCatalogAppDefinition,
    IC_INTEGRATIONS_ID,
    ctx => buildApiIntegrationCatalogBreadcrumbs(ctx, IC_INTEGRATIONS_ID)
  );
  const impactRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(IC_RAIL_PATHS[IC_IMPACT_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogImpactDashboard
    }),
    ctx =>
      railSectionShell(ctx, IC_IMPACT_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_IMPACT_ID)
      })
  );

  return [overviewRoute, apisRoute, apisDetailRoute, integrationsRoute, impactRoute] as const;
};
