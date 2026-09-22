import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import { buildRiskComplianceBreadcrumbs } from './riskComplianceShell';
import {
  RISK_OVERVIEW_ID,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_ASSESSMENTS_ID,
  RISK_RAIL_PATHS
} from './riskComplianceSections';
import {
  validateRisksSearch,
  validateControlsSearch,
  validateRetentionSearch,
  validateAssessmentsSearch
} from '../../routes/searchParams';
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
 * Risk & Compliance's workspace routes: one per rail section, plus the Controls detail route.
 * The former Risks detail route remains as a legacy redirect to the workspace-wide entity drawer
 * search parameter.
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
      validateSearch: validateRisksSearch,
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
  const risksLegacyDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: `${railPath(RISK_RAIL_PATHS[RISK_RISKS_ID])}/$riskId`,
    beforeLoad: ({ params }) => {
      const { workspaceSlug, riskId } = params as unknown as {
        workspaceSlug: string;
        riskId: string;
      };
      throw redirect({
        to: RISK_RAIL_PATHS[RISK_RISKS_ID],
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: riskId })
      });
    }
  });
  const controlsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(RISK_RAIL_PATHS[RISK_CONTROLS_ID]),
      validateSearch: validateControlsSearch,
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
  const controlsDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(RISK_RAIL_PATHS[RISK_CONTROLS_ID])}/$controlId`,
      validateSearch: validateControlsSearch,
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
      validateSearch: validateRetentionSearch,
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
      validateSearch: validateAssessmentsSearch,
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

  return [
    overviewRoute,
    risksRoute,
    risksLegacyDetailRoute,
    controlsRoute,
    controlsDetailRoute,
    retentionRoute,
    assessmentsRoute
  ] as const;
};
