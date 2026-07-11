import { createRoute, getRouteApi, type AnyRoute } from '@tanstack/react-router';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { MarkdownEditorScreen } from '../../sections/markdown/MarkdownEditorScreen';
import { WorkspaceContentSidebar } from '../../sections/workspace-content/WorkspaceContentSidebar';
import { WorkspaceContentScreen } from '../../sections/workspace-content/WorkspaceContentScreen';
import { validateDiagramSearch, validateEntityDetailSearch, validateMarkdownSearch } from '../searchParams';
import { buildWorkspaceContentBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

const contentRouteApi = getRouteApi('/authenticated/$workspaceSlug/content');

const WorkspaceContentRoute = () => {
  const { workspaceSlug } = contentRouteApi.useParams();
  const search = contentRouteApi.useSearch();
  return (
    <WorkspaceContentScreen
      workspaceSlug={workspaceSlug}
      folder={search.contentFolder ?? ''}
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
      validateSearch: validateEntityDetailSearch,
      component: WorkspaceContentRoute
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

  return [contentRoute, contentDiagramRoute, contentMarkdownRoute] as const;
};
