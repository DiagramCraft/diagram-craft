import { createRoute, type AnyRoute } from '@tanstack/react-router';
import {
  buildVendorManagementBreadcrumbs,
  vendorManagementAppDefinition
} from './vendorManagementShell';
import {
  VENDOR_OVERVIEW_ID,
  VENDOR_VENDORS_ID,
  VENDOR_CONTRACTS_ID,
  VENDOR_SPEND_ID,
  VENDOR_RISK_ID,
  VENDOR_RAIL_PATHS
} from './vendorManagementSections';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyVendorOverviewDashboardScreen,
  LazyVendorVendorsDashboardScreen,
  LazyVendorContractsDashboardScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { createDashboardSectionRoute } from '../../routes/workspace/createDashboardSectionRoute';
import { ensureApplicationAccess } from '../../routes/applicationAccess';
import { validateVendorsSearch, validateContractsSearch } from '../../routes/searchParams';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

export const createVendorManagementWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  // The app's landing route (`/$workspaceSlug/vendor-management`, exact) — a summary dashboard. It
  // is `vendorManagementAppDefinition.sections[0]`, so `appRootRoute` opens here from the app
  // switcher.
  const overviewRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(VENDOR_RAIL_PATHS[VENDOR_OVERVIEW_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorOverviewDashboardScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_OVERVIEW_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_OVERVIEW_ID)
      })
  );
  const vendorsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID]),
      validateSearch: validateVendorsSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorVendorsDashboardScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_VENDORS_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_VENDORS_ID)
      })
  );
  const contractsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID]),
      validateSearch: validateContractsSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorContractsDashboardScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_CONTRACTS_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_CONTRACTS_ID)
      })
  );
  // Dashboard-only sections (Spend, Risk) need no screen of their own: the factory builds the
  // route from `vendorManagementAppDefinition.sections`.
  const spendRoute = createDashboardSectionRoute(
    workspaceRoute,
    vendorManagementAppDefinition,
    VENDOR_SPEND_ID,
    ctx => buildVendorManagementBreadcrumbs(ctx, VENDOR_SPEND_ID)
  );
  const riskRoute = createDashboardSectionRoute(
    workspaceRoute,
    vendorManagementAppDefinition,
    VENDOR_RISK_ID,
    ctx => buildVendorManagementBreadcrumbs(ctx, VENDOR_RISK_ID)
  );

  return [overviewRoute, vendorsRoute, contractsRoute, spendRoute, riskRoute] as const;
};
