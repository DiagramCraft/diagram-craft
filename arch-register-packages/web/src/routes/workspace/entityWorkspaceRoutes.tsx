import { createRoute } from '@tanstack/react-router';
import { EntityBrowserScreen } from '../../sections/entities/EntityBrowserScreen';
import { EntityDetailScreen } from '../../sections/entities/EntityDetailScreen';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { ImportScreen } from '../../sections/entities/ImportScreen';
import { EntitiesSidebar } from '../../sections/entities/EntitiesSidebar';
import { EntityContentSidebar } from '../../sections/entities/EntityContentSidebar';
import { validateEntityDetailSearch, validateEntitySearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import {
  buildEntityBreadcrumbs,
  getAllParams
} from '../../layouts/workspaceShellDescriptors';

export const createEntityWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const entityBrowserRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities',
    validateSearch: validateEntitySearch,
    component: EntityBrowserScreen
  });

  const entityDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/$entityId',
    validateSearch: validateEntityDetailSearch,
    component: EntityDetailScreen
  });

  const entityDiagramRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/$entityId/diagrams/$diagramId',
    component: DiagramScreen
  });

  const importRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/import',
    component: ImportScreen,
    validateSearch: validateEntitySearch
  });

  return [
    {
      route: entityBrowserRoute,
      matchesRouteId: routeId => routeId.endsWith('/entities'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: 'entities',
        breadcrumbs: buildEntityBreadcrumbs(ctx, false),
        primarySidebar: (
          <EntitiesSidebar
            schemas={ctx.schemas}
            lifecycleStates={ctx.lifecycleStates}
            workspaceSlug={ctx.workspaceSlug}
          />
        )
      })
    },
    {
      route: importRoute,
      matchesRouteId: routeId => routeId.includes('/entities/import'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: 'entities',
        breadcrumbs: buildEntityBreadcrumbs(ctx, false),
        primarySidebar: (
          <EntitiesSidebar
            schemas={ctx.schemas}
            lifecycleStates={ctx.lifecycleStates}
            workspaceSlug={ctx.workspaceSlug}
          />
        )
      })
    },
    {
      route: entityDetailRoute,
      matchesRouteId: routeId =>
        routeId.includes('/entities/$entityId') && !routeId.includes('/diagrams/$diagramId'),
      buildShell: ctx => {
        const params = getAllParams(ctx.matches);
        return {
          variant: 'detail',
          activeRailItem: 'entities',
          breadcrumbs: buildEntityBreadcrumbs(ctx, true),
          navigationLabel: 'Entities',
          renderNavigation: controls => (
            <EntitiesSidebar
              schemas={ctx.schemas}
              lifecycleStates={ctx.lifecycleStates}
              workspaceSlug={ctx.workspaceSlug}
              onCollapse={controls.collapse}
              onExpand={controls.expand}
            />
          ),
          secondarySidebar: params.entityId ? (
            <EntityContentSidebar workspaceSlug={ctx.workspaceSlug} entityId={params.entityId} />
          ) : undefined
        };
      }
    },
    {
      route: entityDiagramRoute,
      matchesRouteId: routeId => routeId.includes('/entities/$entityId/diagrams/$diagramId'),
      buildShell: () => ({
        variant: 'overlay'
      })
    }
  ];
};
