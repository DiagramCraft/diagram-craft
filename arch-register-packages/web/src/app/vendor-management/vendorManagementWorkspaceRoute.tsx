import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
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
import {
  validateVendorsSearch,
  validateContractsSearch,
  validateSpendSearch,
  validateRiskSearch
} from '../../routes/searchParams';

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
      validateSearch: validateVendorsSearch,
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
  // Legacy deep link: `VendorVendorsScreen` now opens the vendor drawer via the shared
  // `drawer` search param (see useEntityDrawer.ts) instead of a `$vendorId` route, so an old
  // bookmarked `.../vendors/$vendorId` URL is redirected to the equivalent search param.
  const vendorsDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: `${railPath(VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID])}/$vendorId`,
    beforeLoad: ({ params }) => {
      const { workspaceSlug, vendorId } = params as unknown as {
        workspaceSlug: string;
        vendorId: string;
      };
      throw redirect({
        to: VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID],
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: vendorId })
      });
    }
  });
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
      component: LazyVendorContractsScreen
    }),
    ctx =>
      railSectionShell(ctx, VENDOR_CONTRACTS_ID, {
        breadcrumbs: buildVendorManagementBreadcrumbs(ctx, VENDOR_CONTRACTS_ID)
      })
  );
  // Deep-linkable contract drawer, mirroring `vendorsDetailRoute` above — same `component` as the
  // base Contracts route, gated the same way, with the drawer rendered conditionally by
  // `VendorContractsScreen` when the optional `contractId` route param is present.
  const contractsDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID])}/$contractId`,
      validateSearch: validateContractsSearch,
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
      validateSearch: validateSpendSearch,
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
  // Deep-linkable vendor drawer, mirroring `vendorsDetailRoute`/`contractsDetailRoute` above — same
  // `component` as the base Spend route, gated the same way, with the drawer rendered conditionally
  // by `VendorSpendScreen` when the optional `vendorId` route param is present. Its own route (not
  // a redirect to `vendorsDetailRoute`) so the Spend screen's grouping/filter search params survive
  // opening the drawer.
  const spendDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(VENDOR_RAIL_PATHS[VENDOR_SPEND_ID])}/$vendorId`,
      validateSearch: validateSpendSearch,
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
      validateSearch: validateRiskSearch,
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
  // Deep-linkable vendor drawer, mirroring `vendorsDetailRoute`/`spendDetailRoute` above — same
  // `component` as the base Risk route, gated the same way, with the drawer rendered conditionally
  // by `VendorRiskScreen` when the optional `vendorId` route param is present. Its own route (not
  // a redirect to `vendorsDetailRoute`) so the Risk screen's filter search params survive opening
  // the drawer.
  const riskDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(VENDOR_RAIL_PATHS[VENDOR_RISK_ID])}/$vendorId`,
      validateSearch: validateRiskSearch,
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

  return [
    overviewRoute,
    vendorsRoute,
    vendorsDetailRoute,
    contractsRoute,
    contractsDetailRoute,
    spendRoute,
    spendDetailRoute,
    riskRoute,
    riskDetailRoute
  ] as const;
};
