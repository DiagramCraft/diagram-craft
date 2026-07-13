import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { EntitiesSidebar } from '../../sections/entities/EntitiesSidebar';
import { EntityContentSidebar } from '../../sections/entities/EntityContentSidebar';
import {
  validateDiagramSearch,
  validateEntityDetailSearch,
  validateEntitySearch,
  validateMarkdownSearch
} from '../searchParams';
import { buildEntityBreadcrumbs, getAllParams } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import {
  LazyDiagramScreen,
  LazyEntityBrowserScreen,
  LazyEntityDetailScreen,
  LazyImportScreen,
  LazyMarkdownEditorScreen
} from './lazyWorkspaceScreens';

export const createEntityWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const entityBrowserRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities',
      validateSearch: validateEntitySearch,
      component: LazyEntityBrowserScreen
    }),
    ctx => ({
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
  );

  const entityDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId',
      validateSearch: validateEntityDetailSearch,
      component: LazyEntityDetailScreen
    }),
    ctx => {
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
            onCollapse={controls.expanded ? controls.collapse : undefined}
            onExpand={controls.expanded ? undefined : controls.expand}
          />
        ),
        secondarySidebar: params.entityId ? (
          <EntityContentSidebar workspaceSlug={ctx.workspaceSlug} entityId={params.entityId} />
        ) : undefined
      };
    }
  );

  const entityDiagramRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId/diagrams/$diagramId',
      validateSearch: validateDiagramSearch,
      component: LazyDiagramScreen
    }),
    () => ({
      variant: 'overlay'
    })
  );

  const importRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/import',
      component: LazyImportScreen,
      validateSearch: validateEntitySearch
    }),
    ctx => ({
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
  );

  const entityMarkdownRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId/wiki/$nodeId',
      validateSearch: validateMarkdownSearch,
      component: LazyMarkdownEditorScreen
    }),
    ctx => {
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
            onCollapse={controls.expanded ? controls.collapse : undefined}
            onExpand={controls.expanded ? undefined : controls.expand}
          />
        ),
        secondarySidebar: params.entityId ? (
          <EntityContentSidebar workspaceSlug={ctx.workspaceSlug} entityId={params.entityId} />
        ) : undefined
      };
    }
  );

  return [
    entityBrowserRoute,
    importRoute,
    entityDetailRoute,
    entityDiagramRoute,
    entityMarkdownRoute
  ] as const;
};
