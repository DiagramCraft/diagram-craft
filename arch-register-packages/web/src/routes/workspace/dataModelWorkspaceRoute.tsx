import { createRoute } from '@tanstack/react-router';
import { DataModelEditorScreen } from '../../sections/data-model/DataModelEditorScreen';
import { DataModelSidebar } from '../../sections/data-model/DataModelSidebar';
import { validateModelSearch } from '../searchParams';
import { buildModelBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createDataModelWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const route = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'model',
    validateSearch: validateModelSearch,
    component: DataModelEditorScreen
  }), ctx => ({
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
  }));

  return [route];
};
