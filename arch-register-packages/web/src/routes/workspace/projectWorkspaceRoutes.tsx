import { createRoute, useParams, type AnyRoute } from '@tanstack/react-router';
import { ProjectsSidebar } from '../../sections/projects/ProjectsSidebar';
import { ProjectContentSidebar } from '../../sections/projects/ProjectContentSidebar';
import {
  validateDiagramSearch,
  validateMarkdownSearch,
  validateProjectSearch
} from '../searchParams';
import { buildProjectBreadcrumbs, getAllParams } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell, type WorkspaceShellBuilder } from './workspaceShellRoute';
import {
  LazyDiagramScreen,
  LazyMarkdownEditorScreen,
  LazyProjectDetailScreen,
  LazyProjectsScreen
} from './lazyWorkspaceScreens';

const ProjectContentFolderRoute = () => {
  const { _splat } = useParams({ strict: false });
  return <LazyProjectDetailScreen folder={_splat ?? ''} />;
};

export const createProjectWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const projectsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects',
      validateSearch: validateProjectSearch,
      component: LazyProjectsScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'projects',
      breadcrumbs: buildProjectBreadcrumbs(ctx),
      primarySidebar: <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />
    })
  );

  const buildDetailShell: WorkspaceShellBuilder = ctx => {
    const params = getAllParams(ctx.matches);
    return {
      variant: 'detail' as const,
      activeRailItem: 'projects' as const,
      breadcrumbs: buildProjectBreadcrumbs(ctx),
      navigationLabel: 'Projects',
      renderNavigation: controls => (
        <ProjectsSidebar
          projects={ctx.projects}
          workspaceSlug={ctx.workspaceSlug}
          onCollapse={controls.expanded ? controls.collapse : undefined}
          onExpand={controls.expanded ? undefined : controls.expand}
        />
      ),
      secondarySidebar: params.projectId ? (
        <ProjectContentSidebar workspaceSlug={ctx.workspaceSlug} projectId={params.projectId} />
      ) : undefined
    };
  };

  const projectDetailRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects/$projectId',
      validateSearch: validateProjectSearch,
      component: LazyProjectDetailScreen
    }),
    buildDetailShell
  );

  const projectContentFolderRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects/$projectId/folders/$',
      validateSearch: validateProjectSearch,
      component: ProjectContentFolderRoute
    }),
    buildDetailShell
  );

  const diagramRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects/$projectId/diagrams/$diagramId',
      validateSearch: validateDiagramSearch,
      component: LazyDiagramScreen
    }),
    () => ({ variant: 'overlay' })
  );

  const markdownRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects/$projectId/wiki/$nodeId',
      validateSearch: validateMarkdownSearch,
      component: LazyMarkdownEditorScreen
    }),
    buildDetailShell
  );

  const markdownDraftRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'projects/$projectId/wiki/new',
      validateSearch: validateMarkdownSearch,
      component: LazyMarkdownEditorScreen
    }),
    buildDetailShell
  );

  return [
    projectsRoute,
    projectDetailRoute,
    projectContentFolderRoute,
    diagramRoute,
    markdownRoute,
    markdownDraftRoute
  ] as const;
};
