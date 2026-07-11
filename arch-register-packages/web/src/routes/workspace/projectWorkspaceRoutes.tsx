import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { ProjectsScreen } from '../../sections/projects/ProjectsScreen';
import { ProjectDetailScreen } from '../../sections/projects/ProjectDetailScreen';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { MarkdownEditorScreen } from '../../sections/markdown/MarkdownEditorScreen';
import { ProjectsSidebar } from '../../sections/projects/ProjectsSidebar';
import { ProjectContentSidebar } from '../../sections/projects/ProjectContentSidebar';
import { validateDiagramSearch, validateMarkdownSearch, validateProjectSearch } from '../searchParams';
import { buildProjectBreadcrumbs, getAllParams } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createProjectWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const projectsRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects',
    validateSearch: validateProjectSearch,
    component: ProjectsScreen
  }), ctx => ({
    variant: 'standard',
    activeRailItem: 'projects',
    breadcrumbs: buildProjectBreadcrumbs(ctx),
    primarySidebar: (
      <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />
    )
  }));

  const projectDetailRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId',
    validateSearch: validateProjectSearch,
    component: ProjectDetailScreen
  }), ctx => {
    const params = getAllParams(ctx.matches);
    return {
      variant: 'detail',
      activeRailItem: 'projects',
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
  });

  const diagramRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId/diagrams/$diagramId',
    validateSearch: validateDiagramSearch,
    component: DiagramScreen
  }), () => ({
    variant: 'overlay'
  }));

  const markdownRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId/wiki/$nodeId',
    validateSearch: validateMarkdownSearch,
    component: MarkdownEditorScreen
  }), ctx => {
    const params = getAllParams(ctx.matches);
    return {
      variant: 'detail',
      activeRailItem: 'projects',
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
  });

  return [projectsRoute, projectDetailRoute, diagramRoute, markdownRoute] as const;
};
