import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildGlossaryBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { LazyGlossaryScreen, LazyGlossaryTermScreen } from './lazyWorkspaceScreens';

export const createGlossaryWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const glossaryRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'glossary',
      component: LazyGlossaryScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'glossary',
      breadcrumbs: buildGlossaryBreadcrumbs(ctx)
    })
  );
  const glossaryTermRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'glossary/$termId',
      component: LazyGlossaryTermScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'glossary',
      breadcrumbs: buildGlossaryBreadcrumbs(ctx, true)
    })
  );
  return [glossaryRoute, glossaryTermRoute] as const;
};
