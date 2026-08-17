import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildGlossaryBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { validateGlossarySearch } from '../searchParams';
import { GlossarySidebar } from '../../sections/glossary/GlossarySidebar';
import { LazyGlossaryScreen, LazyGlossaryTermScreen } from './lazyWorkspaceScreens';

export const createGlossaryWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const glossaryRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'glossary',
      validateSearch: validateGlossarySearch,
      component: LazyGlossaryScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: 'glossary',
      breadcrumbs: buildGlossaryBreadcrumbs(ctx),
      primarySidebar: <GlossarySidebar workspaceSlug={ctx.workspaceSlug} />
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
      breadcrumbs: buildGlossaryBreadcrumbs(ctx, true),
      primarySidebar: <GlossarySidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );
  return [glossaryRoute, glossaryTermRoute] as const;
};
