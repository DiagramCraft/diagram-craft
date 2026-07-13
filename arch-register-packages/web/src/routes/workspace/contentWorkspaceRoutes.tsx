import { createRoute, useParams, type AnyRoute } from '@tanstack/react-router';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { MarkdownEditorScreen } from '../../sections/markdown/MarkdownEditorScreen';
import { WorkspaceContentSidebar } from '../../sections/workspace-content/WorkspaceContentSidebar';
import { WorkspaceContentScreen } from '../../sections/workspace-content/WorkspaceContentScreen';
import {
  validateDiagramSearch,
  validateMarkdownSearch,
  validateWorkspaceContentSearch
} from '../searchParams';
import { buildWorkspaceContentBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

const WorkspaceContentRoute = () => {
  const { workspaceSlug } = useParams({ strict: false });
  return (
    <WorkspaceContentScreen
      workspaceSlug={workspaceSlug!}
      folder=""
    />
  );
};

const WorkspaceContentFolderRoute = () => {
  const { workspaceSlug, _splat } = useParams({ strict: false });
  return (
    <WorkspaceContentScreen
      workspaceSlug={workspaceSlug!}
      folder={_splat ?? ''}
    />
  );
};

export const createContentWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const contentRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content',
      validateSearch: validateWorkspaceContentSearch,
      component: WorkspaceContentRoute
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'content',
      breadcrumbs: buildWorkspaceContentBreadcrumbs(ctx),
      primarySidebar: <WorkspaceContentSidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );

  const contentFolderRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/folders/$',
      validateSearch: validateWorkspaceContentSearch,
      component: WorkspaceContentFolderRoute
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
      component: DiagramScreen
    }),
    () => ({ variant: 'overlay' })
  );

  const contentMarkdownRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/wiki/$nodeId',
      validateSearch: validateMarkdownSearch,
      component: MarkdownEditorScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'content',
      breadcrumbs: buildWorkspaceContentBreadcrumbs(ctx),
      primarySidebar: <WorkspaceContentSidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );

  return [contentRoute, contentFolderRoute, contentDiagramRoute, contentMarkdownRoute] as const;
};
