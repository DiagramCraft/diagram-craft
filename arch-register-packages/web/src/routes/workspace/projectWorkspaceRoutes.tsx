import { createRoute } from '@tanstack/react-router';
import { ProjectDetailScreen } from '../../sections/projects/ProjectDetailScreen';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { ProjectsSidebar } from '../../sections/projects/ProjectsSidebar';
import { validateProjectSearch } from '../searchParams';
import { buildProjectBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createProjectWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const projectDetailRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId',
    validateSearch: validateProjectSearch,
    component: ProjectDetailScreen
  }), ctx => ({
    variant: 'standard',
    activeRailItem: 'projects',
    breadcrumbs: buildProjectBreadcrumbs(ctx),
    primarySidebar: (
      <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />
    )
  }));

  const diagramRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId/diagrams/$diagramId',
    component: DiagramScreen
  }), () => ({
    variant: 'overlay'
  }));

  return [projectDetailRoute, diagramRoute];
};
