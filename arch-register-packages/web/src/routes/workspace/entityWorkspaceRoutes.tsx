import { createRoute, useParams, type AnyRoute } from '@tanstack/react-router';
import { EntitiesSidebar } from '../../sections/entities/EntitiesSidebar';
import { EntityContentSidebar } from '../../sections/entities/EntityContentSidebar';
import {
  validateDiagramSearch,
  validateEntityDetailSearch,
  validateEntitySearch,
  validateMarkdownSearch
} from '../searchParams';
import { buildEntityBreadcrumbs, getAllParams } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell, type WorkspaceShellBuilder } from './workspaceShellRoute';
import {
  LazyDiagramScreen,
  LazyEntityBrowserScreen,
  LazyEntityDetailScreen,
  LazyImportScreen,
  LazyMarkdownEditorScreen
} from './lazyWorkspaceScreens';

const EntityContentFolderRoute = () => {
  const { _splat } = useParams({ strict: false });
  return <LazyEntityDetailScreen folder={_splat ?? ''} />;
};

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

  const buildDetailShell: WorkspaceShellBuilder = ctx => {
    const params = getAllParams(ctx.matches);
    return {
      variant: 'detail' as const,
      activeRailItem: 'entities' as const,
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
  };

  const entityDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId',
      validateSearch: validateEntityDetailSearch,
      component: LazyEntityDetailScreen
    }),
    buildDetailShell
  );

  const entityContentFolderRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId/folders/$',
      validateSearch: validateEntityDetailSearch,
      component: EntityContentFolderRoute
    }),
    buildDetailShell
  );

  const entityDiagramRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'entities/$entityId/diagrams/$diagramId',
      validateSearch: validateDiagramSearch,
      component: LazyDiagramScreen
    }),
    () => ({ variant: 'overlay' })
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
    buildDetailShell
  );

  return [
    entityBrowserRoute,
    importRoute,
    entityDetailRoute,
    entityContentFolderRoute,
    entityDiagramRoute,
    entityMarkdownRoute
  ] as const;
};
