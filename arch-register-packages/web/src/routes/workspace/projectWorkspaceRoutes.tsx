import { createRoute } from '@tanstack/react-router';
import { ProjectDetailScreen } from '../../sections/projects/ProjectDetailScreen';
import { DiagramScreen } from '../../sections/projects/DiagramScreen';
import { ProjectsSidebar } from '../../sections/projects/ProjectsSidebar';
import { validateProjectSearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildProjectBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createProjectWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const projectDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId',
    validateSearch: validateProjectSearch,
    component: ProjectDetailScreen
  });

  const diagramRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'projects/$projectId/diagrams/$diagramId',
    component: DiagramScreen
  });

  return [
    {
      route: projectDetailRoute,
      matchesRouteId: routeId =>
        routeId.includes('/projects/$projectId') && !routeId.includes('/diagrams/$diagramId'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: 'projects',
        breadcrumbs: buildProjectBreadcrumbs(ctx),
        primarySidebar: (
          <ProjectsSidebar projects={ctx.projects} workspaceSlug={ctx.workspaceSlug} />
        )
      })
    },
    {
      route: diagramRoute,
      matchesRouteId: routeId => routeId.includes('/projects/$projectId/diagrams/$diagramId'),
      buildShell: () => ({
        variant: 'overlay'
      })
    }
  ];
};
