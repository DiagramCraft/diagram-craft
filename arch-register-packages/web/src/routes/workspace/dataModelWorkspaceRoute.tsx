import { createRoute } from '@tanstack/react-router';
import { DataModelEditorScreen } from '../../sections/data-model/DataModelEditorScreen';
import { DataModelSidebar } from '../../sections/data-model/DataModelSidebar';
import { validateModelSearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildModelBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createDataModelWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const route = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'model',
    validateSearch: validateModelSearch,
    component: DataModelEditorScreen
  });

  return [
    {
      route,
      matchesRouteId: routeId => routeId.endsWith('/model'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: 'model',
        breadcrumbs: buildModelBreadcrumbs(ctx),
        primarySidebar: (
          <DataModelSidebar
            schemas={ctx.schemas}
            enums={ctx.enums}
            workspaceSlug={ctx.workspaceSlug}
          />
        )
      })
    }
  ];
};
