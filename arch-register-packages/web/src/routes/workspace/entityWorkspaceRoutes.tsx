import { createRoute } from '@tanstack/react-router';
import { EntityBrowserScreen } from '../../sections/entities/EntityBrowserScreen';
import { EntityDetailScreen } from '../../sections/entities/EntityDetailScreen';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { MarkdownEditorScreen } from '../../sections/markdown/MarkdownEditorScreen';
import { ImportScreen } from '../../sections/entities/ImportScreen';
import { EntitiesSidebar } from '../../sections/entities/EntitiesSidebar';
import { EntityContentSidebar } from '../../sections/entities/EntityContentSidebar';
import {
  validateDiagramSearch,
  validateEntityDetailSearch,
  validateEntitySearch,
  validateMarkdownSearch
} from '../searchParams';
import {
  buildEntityBreadcrumbs,
  getAllParams
} from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createEntityWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const entityBrowserRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities',
    validateSearch: validateEntitySearch,
    component: EntityBrowserScreen
  }), ctx => ({
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
  }));

  const entityDetailRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/$entityId',
    validateSearch: validateEntityDetailSearch,
    component: EntityDetailScreen
  }), ctx => {
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
  });

  const entityDiagramRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/$entityId/diagrams/$diagramId',
    validateSearch: validateDiagramSearch,
    component: DiagramScreen
  }), () => ({
    variant: 'overlay'
  }));

  const importRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/import',
    component: ImportScreen,
    validateSearch: validateEntitySearch
  }), ctx => ({
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
  }));

  const entityMarkdownRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'entities/$entityId/wiki/$nodeId',
    validateSearch: validateMarkdownSearch,
    component: MarkdownEditorScreen
  }), ctx => {
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
  });

  return [entityBrowserRoute, importRoute, entityDetailRoute, entityDiagramRoute, entityMarkdownRoute];
};
