import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { WorkspaceContentSidebar } from '../../sections/workspace-content/WorkspaceContentSidebar';
import {
  validateDiagramSearch,
  validateMarkdownSearch,
  validateWorkspaceContentSearch
} from '../searchParams';
import { buildWorkspaceContentBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell, type WorkspaceShellBuilder } from './workspaceShellRoute';
import {
  LazyDiagramScreen,
  LazyMarkdownDraftScreen,
  LazyMarkdownEditorScreen,
  LazyWorkspaceContentFolderRoute,
  LazyWorkspaceContentRoute
} from './lazyWorkspaceScreens';

export const createContentWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const buildShell: WorkspaceShellBuilder = ctx => ({
    variant: 'standard' as const,
    activeRailItem: 'content' as const,
    breadcrumbs: buildWorkspaceContentBreadcrumbs(ctx),
    primarySidebar: <WorkspaceContentSidebar workspaceSlug={ctx.workspaceSlug} />
  });

  const contentRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content',
      validateSearch: validateWorkspaceContentSearch,
      component: LazyWorkspaceContentRoute
    }),
    buildShell
  );

  const contentFolderRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/folders/$',
      validateSearch: validateWorkspaceContentSearch,
      component: LazyWorkspaceContentFolderRoute
    }),
    buildShell
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
    buildShell
  );

  const contentMarkdownDraftRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/wiki/new',
      validateSearch: validateMarkdownSearch,
      component: LazyMarkdownDraftScreen
    }),
    buildShell
  );

  return [contentRoute, contentFolderRoute, contentDiagramRoute, contentMarkdownRoute, contentMarkdownDraftRoute] as const;
};
