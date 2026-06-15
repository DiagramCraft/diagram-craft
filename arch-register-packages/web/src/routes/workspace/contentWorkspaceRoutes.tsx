import { createRoute } from '@tanstack/react-router';
import { useParams, useSearch } from '@tanstack/react-router';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { MarkdownEditorScreen } from '../../sections/markdown/MarkdownEditorScreen';
import { WorkspaceContentSidebar } from '../../sections/workspace-content/WorkspaceContentSidebar';
import { WorkspaceContentScreen } from '../../sections/workspace-content/WorkspaceContentScreen';
import { validateEntityDetailSearch, validateMarkdownSearch } from '../searchParams';
import { buildWorkspaceContentBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

const WorkspaceContentRoute = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string };
  return (
    <WorkspaceContentScreen
      workspaceSlug={workspaceSlug}
      folder={search.contentFolder ?? ''}
    />
  );
};

export const createContentWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
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
      component: DiagramScreen
    }),
    () => ({ variant: 'overlay' })
  );

  const contentMarkdownRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'content/markdown/$nodeId',
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

  return [contentRoute, contentDiagramRoute, contentMarkdownRoute];
};
