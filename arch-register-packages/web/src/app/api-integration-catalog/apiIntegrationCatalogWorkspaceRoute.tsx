import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildApiIntegrationCatalogBreadcrumbs } from './apiIntegrationCatalogShell';
import {
  IC_OVERVIEW_ID,
  IC_APIS_ID,
  IC_INTEGRATIONS_ID,
  IC_SYNC_ID,
  IC_IMPACT_ID,
  IC_RAIL_PATHS
} from './apiIntegrationCatalogSections';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyApiIntegrationCatalogOverviewScreen,
  LazyApiIntegrationCatalogApisScreen,
  LazyApiIntegrationCatalogIntegrationsScreen,
  LazyApiIntegrationCatalogSyncScreen,
  LazyApiIntegrationCatalogImpactScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';
import { validateApiIntegrationCatalogIntegrationsSearch } from '../../routes/searchParams';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

/**
 * API & Integration Catalog's workspace routes: one per rail section, plus the APIs section's
 * deep-linkable spec drawer route (#3316). Mirrors `../risk-compliance/riskComplianceWorkspaceRoute.tsx`.
 * Integrations, Sync, and Impact remain placeholder screens with no detail routes yet; those land
 * alongside their section's real content in later sub-issues of #3150 (#3317-#3320).
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
      component: LazyApiIntegrationCatalogOverviewScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_OVERVIEW_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_OVERVIEW_ID)
      })
  );
  const apisRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(IC_RAIL_PATHS[IC_APIS_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogApisScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_APIS_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_APIS_ID)
      })
  );
  // Deep-linkable API spec drawer, mirroring `vendorManagementWorkspaceRoute.tsx`'s
  // `vendorsDetailRoute` — same `component` as the base APIs route, gated the same way, with the
  // drawer rendered conditionally by `ApiIntegrationCatalogApisScreen` when the optional `apiId`
  // route param is present.
  const apisDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(IC_RAIL_PATHS[IC_APIS_ID])}/$apiId`,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogApisScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_APIS_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_APIS_ID)
      })
  );
  const integrationsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(IC_RAIL_PATHS[IC_INTEGRATIONS_ID]),
      validateSearch: validateApiIntegrationCatalogIntegrationsSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogIntegrationsScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_INTEGRATIONS_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_INTEGRATIONS_ID)
      })
  );
  const syncRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(IC_RAIL_PATHS[IC_SYNC_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'api-integration-catalog'
        ),
      component: LazyApiIntegrationCatalogSyncScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_SYNC_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_SYNC_ID)
      })
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
      component: LazyApiIntegrationCatalogImpactScreen
    }),
    ctx =>
      railSectionShell(ctx, IC_IMPACT_ID, {
        breadcrumbs: buildApiIntegrationCatalogBreadcrumbs(ctx, IC_IMPACT_ID)
      })
  );

  return [
    overviewRoute,
    apisRoute,
    apisDetailRoute,
    integrationsRoute,
    syncRoute,
    impactRoute
  ] as const;
};
