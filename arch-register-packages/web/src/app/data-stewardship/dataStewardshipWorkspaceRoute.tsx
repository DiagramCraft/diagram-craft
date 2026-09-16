import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildDataStewardshipBreadcrumbs } from './dataStewardshipShell';
import {
  DS_MY_WORK_ID,
  DS_STEWARDSHIP_ID,
  DS_CLASSIFICATION_ID,
  DS_CHANGE_CASES_ID,
  DS_ASSESSMENTS_ID,
  DS_RAIL_PATHS
} from './dataStewardshipSections';
import { validateDataStewardshipStewardshipSearch } from '../../routes/searchParams';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyDataStewardshipMyWorkScreen,
  LazyDataStewardshipStewardshipScreen,
  LazyDataStewardshipClassificationScreen,
  LazyDataStewardshipChangeCasesScreen,
  LazyDataStewardshipAssessmentsScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

/**
 * Data Stewardship's workspace routes: one per rail section. Mirrors
 * `../risk-compliance/riskComplianceWorkspaceRoute.tsx`, minus any deep-linkable detail routes —
 * this is a scaffold with placeholder screens only (#3297); detail drawers land alongside their
 * section's real content in later sub-issues of #3152.
 */
export const createDataStewardshipWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  // The app's landing route (`/$workspaceSlug/data-stewardship`, exact). It is
  // `dataStewardshipAppDefinition.sections[0]`, so `appRootRoute` opens here from the app switcher.
  const myWorkRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(DS_RAIL_PATHS[DS_MY_WORK_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'data-stewardship'
        ),
      component: LazyDataStewardshipMyWorkScreen
    }),
    ctx =>
      railSectionShell(ctx, DS_MY_WORK_ID, {
        breadcrumbs: buildDataStewardshipBreadcrumbs(ctx, DS_MY_WORK_ID)
      })
  );
  const stewardshipRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(DS_RAIL_PATHS[DS_STEWARDSHIP_ID]),
      validateSearch: validateDataStewardshipStewardshipSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'data-stewardship'
        ),
      component: LazyDataStewardshipStewardshipScreen
    }),
    ctx =>
      railSectionShell(ctx, DS_STEWARDSHIP_ID, {
        breadcrumbs: buildDataStewardshipBreadcrumbs(ctx, DS_STEWARDSHIP_ID)
      })
  );
  const classificationRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(DS_RAIL_PATHS[DS_CLASSIFICATION_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'data-stewardship'
        ),
      component: LazyDataStewardshipClassificationScreen
    }),
    ctx =>
      railSectionShell(ctx, DS_CLASSIFICATION_ID, {
        breadcrumbs: buildDataStewardshipBreadcrumbs(ctx, DS_CLASSIFICATION_ID)
      })
  );
  const changeCasesRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(DS_RAIL_PATHS[DS_CHANGE_CASES_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'data-stewardship'
        ),
      component: LazyDataStewardshipChangeCasesScreen
    }),
    ctx =>
      railSectionShell(ctx, DS_CHANGE_CASES_ID, {
        breadcrumbs: buildDataStewardshipBreadcrumbs(ctx, DS_CHANGE_CASES_ID)
      })
  );
  const assessmentsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(DS_RAIL_PATHS[DS_ASSESSMENTS_ID]),
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'data-stewardship'
        ),
      component: LazyDataStewardshipAssessmentsScreen
    }),
    ctx =>
      railSectionShell(ctx, DS_ASSESSMENTS_ID, {
        breadcrumbs: buildDataStewardshipBreadcrumbs(ctx, DS_ASSESSMENTS_ID)
      })
  );

  return [
    myWorkRoute,
    stewardshipRoute,
    classificationRoute,
    changeCasesRoute,
    assessmentsRoute
  ] as const;
};
