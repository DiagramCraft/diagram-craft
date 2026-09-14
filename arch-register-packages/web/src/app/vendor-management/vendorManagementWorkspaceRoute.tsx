import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildVendorManagementBreadcrumbs } from './vendorManagementShell';
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
  LazyVendorOverviewScreen,
  LazyVendorVendorsScreen,
  LazyVendorContractsScreen,
  LazyVendorSpendScreen,
  LazyVendorRiskScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';

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
      component: LazyVendorOverviewScreen
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
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorVendorsScreen
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
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorContractsScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_CONTRACTS_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_CONTRACTS_ID)
      })
  );
  const spendRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(VENDOR_RAIL_PATHS[VENDOR_SPEND_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorSpendScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_SPEND_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_SPEND_ID)
      })
  );
  const riskRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(VENDOR_RAIL_PATHS[VENDOR_RISK_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'vendor-management'
        ),
      component: LazyVendorRiskScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_RISK_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_RISK_ID)
      })
  );

  return [overviewRoute, vendorsRoute, contractsRoute, spendRoute, riskRoute] as const;
};
