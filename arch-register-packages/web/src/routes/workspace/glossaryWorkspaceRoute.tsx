import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildGlossaryBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { validateGlossarySearch } from '../searchParams';
import { GlossarySidebar } from '../../sections/glossary/GlossarySidebar';
import { LazyGlossaryScreen } from './lazyWorkspaceScreens';

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
      validateSearch: validateGlossarySearch,
      // Renders the same GlossaryScreen (list) with the term opened as a slide-over drawer on
      // top, rather than a separate page — keeps the deep-linkable /glossary/$termId URL while
      // matching the Claude Design mockup's drawer interaction.
      component: LazyGlossaryScreen
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
