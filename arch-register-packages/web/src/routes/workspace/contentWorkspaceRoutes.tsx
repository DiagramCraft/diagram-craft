import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { WorkspaceContentSidebar } from '../../sections/workspace-content/WorkspaceContentSidebar';
import {
  validateDiagramSearch,
  validateEntityDetailSearch,
  validateMarkdownSearch
} from '../searchParams';
import { buildWorkspaceContentBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import {
  LazyDiagramScreen,
  LazyMarkdownEditorScreen,
  LazyWorkspaceContentRoute
} from './lazyWorkspaceScreens';

export const createContentWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const contentRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content',
      validateSearch: validateEntityDetailSearch,
      component: LazyWorkspaceContentRoute
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'content',
      breadcrumbs: buildWorkspaceContentBreadcrumbs(ctx),
      primarySidebar: <WorkspaceContentSidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );

  const contentDiagramRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/diagrams/$diagramId',
      validateSearch: validateDiagramSearch,
      component: LazyDiagramScreen
    }),
    () => ({ variant: 'overlay' })
  );

  const contentMarkdownRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/wiki/$nodeId',
      validateSearch: validateMarkdownSearch,
      component: LazyMarkdownEditorScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'content',
      breadcrumbs: buildWorkspaceContentBreadcrumbs(ctx),
      primarySidebar: <WorkspaceContentSidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );

  return [contentRoute, contentDiagramRoute, contentMarkdownRoute] as const;
};
