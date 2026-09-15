import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildRiskComplianceBreadcrumbs } from './riskComplianceShell';
import {
  RISK_OVERVIEW_ID,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_ASSESSMENTS_ID,
  RISK_RAIL_PATHS
} from './riskComplianceSections';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyRiskComplianceOverviewScreen,
  LazyRiskComplianceRisksScreen,
  LazyRiskComplianceControlsScreen,
  LazyRiskComplianceRetentionScreen,
  LazyRiskComplianceAssessmentsScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

/**
 * Risk & Compliance's workspace routes: one per rail section, no detail/drawer routes and no
 * `validateSearch` yet — this is the #3278 scaffold (placeholder screens only). Mirrors
 * `../vendor-management/vendorManagementWorkspaceRoute.tsx`'s base per-section routes.
 */
export const createRiskComplianceWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  // The app's landing route (`/$workspaceSlug/risk-compliance`, exact). It is
  // `riskComplianceAppDefinition.sections[0]`, so `appRootRoute` opens here from the app switcher.
  const overviewRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_OVERVIEW_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'risk-compliance'
        ),
      component: LazyRiskComplianceOverviewScreen
    }),
    ctx =>
      railSectionShell(ctx, RISK_OVERVIEW_ID, {
        breadcrumbs: buildRiskComplianceBreadcrumbs(ctx, RISK_OVERVIEW_ID)
      })
  );
  const risksRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_RISKS_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'risk-compliance'
        ),
      component: LazyRiskComplianceRisksScreen
    }),
    ctx =>
      railSectionShell(ctx, RISK_RISKS_ID, {
        breadcrumbs: buildRiskComplianceBreadcrumbs(ctx, RISK_RISKS_ID)
      })
  );
  const controlsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_CONTROLS_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'risk-compliance'
        ),
      component: LazyRiskComplianceControlsScreen
    }),
    ctx =>
      railSectionShell(ctx, RISK_CONTROLS_ID, {
        breadcrumbs: buildRiskComplianceBreadcrumbs(ctx, RISK_CONTROLS_ID)
      })
  );
  const retentionRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_RETENTION_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'risk-compliance'
        ),
      component: LazyRiskComplianceRetentionScreen
    }),
    ctx =>
      railSectionShell(ctx, RISK_RETENTION_ID, {
        breadcrumbs: buildRiskComplianceBreadcrumbs(ctx, RISK_RETENTION_ID)
      })
  );
  const assessmentsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_ASSESSMENTS_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'risk-compliance'
        ),
      component: LazyRiskComplianceAssessmentsScreen
    }),
    ctx =>
      railSectionShell(ctx, RISK_ASSESSMENTS_ID, {
        breadcrumbs: buildRiskComplianceBreadcrumbs(ctx, RISK_ASSESSMENTS_ID)
      })
  );

  return [overviewRoute, risksRoute, controlsRoute, retentionRoute, assessmentsRoute] as const;
};
