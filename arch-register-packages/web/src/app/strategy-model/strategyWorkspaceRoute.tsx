import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildStrategyBreadcrumbs } from './strategyShell';
import {
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_HEATMAPS_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID,
  STRATEGY_RAIL_PATHS
} from './strategySections';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import {
  LazyStrategyCapabilityMapScreen,
  LazyStrategyCapabilitiesScreen,
  LazyStrategyHeatmapsScreen,
  LazyStrategyStrategyScreen,
  LazyStrategyTraceabilityScreen
} from '../../routes/workspace/lazyWorkspaceScreens';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

export const createStrategyWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const capabilityMapRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID]),
      component: LazyStrategyCapabilityMapScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_CAPABILITY_MAP_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_CAPABILITY_MAP_ID)
      })
  );
  const capabilitiesRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]),
      component: LazyStrategyCapabilitiesScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_CAPABILITIES_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_CAPABILITIES_ID)
      })
  );
  const heatmapsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_HEATMAPS_ID]),
      component: LazyStrategyHeatmapsScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_HEATMAPS_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_HEATMAPS_ID)
      })
  );
  const strategyRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_STRATEGY_ID]),
      component: LazyStrategyStrategyScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_STRATEGY_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_STRATEGY_ID)
      })
  );
  const traceabilityRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_TRACEABILITY_ID]),
      component: LazyStrategyTraceabilityScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_TRACEABILITY_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_TRACEABILITY_ID)
      })
  );

  return [
    capabilityMapRoute,
    capabilitiesRoute,
    heatmapsRoute,
    strategyRoute,
    traceabilityRoute
  ] as const;
};
