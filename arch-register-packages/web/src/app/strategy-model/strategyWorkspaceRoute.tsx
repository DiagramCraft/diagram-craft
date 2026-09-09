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
import { validateCapabilitiesSearch, validateCapabilityMapSearch } from '../../routes/searchParams';
import {
  LazyStrategyCapabilityMapScreen,
  LazyStrategyCapabilitiesScreen,
  LazyStrategyHeatmapsScreen,
  LazyStrategyStrategyScreen,
  LazyStrategyTraceabilityScreen
} from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';

const railPath = (path: string) => path.replace('/$workspaceSlug/', '');

export const createStrategyWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const capabilityMapRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: railPath(STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID]),
      validateSearch: validateCapabilityMapSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
      component: LazyStrategyCapabilityMapScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_CAPABILITY_MAP_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_CAPABILITY_MAP_ID)
      })
  );
  // Renders the same StrategyCapabilityMapScreen with a capability opened as a slide-over drawer
  // on top, rather than a separate page — keeps the deep-linkable /strategy/map/$id URL, mirroring
  // `glossaryWorkspaceRoute.tsx`'s `glossaryTermRoute`.
  const capabilityMapDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID])}/$capabilityId`,
      validateSearch: validateCapabilityMapSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
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
      validateSearch: validateCapabilitiesSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
      component: LazyStrategyCapabilitiesScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_CAPABILITIES_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_CAPABILITIES_ID)
      })
  );
  // See `capabilityMapDetailRoute` above — same pattern, deep-linkable from the list section too.
  const capabilitiesDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: `${railPath(STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID])}/$capabilityId`,
      validateSearch: validateCapabilitiesSearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
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
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
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
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
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
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'strategy-model'
        ),
      component: LazyStrategyTraceabilityScreen
    }),
    ctx =>
      railSectionShell(ctx, STRATEGY_TRACEABILITY_ID, {
        breadcrumbs: buildStrategyBreadcrumbs(ctx, STRATEGY_TRACEABILITY_ID)
      })
  );

  return [
    capabilityMapRoute,
    capabilityMapDetailRoute,
    capabilitiesRoute,
    capabilitiesDetailRoute,
    heatmapsRoute,
    strategyRoute,
    traceabilityRoute
  ] as const;
};
