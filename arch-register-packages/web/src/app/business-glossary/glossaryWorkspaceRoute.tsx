import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildGlossaryBreadcrumbs } from './glossaryShell';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { validateGlossarySearch } from '../../routes/searchParams';
import { GlossarySidebar } from './sections/GlossarySidebar';
import { LazyGlossaryScreen } from '../../routes/workspace/lazyWorkspaceScreens';

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
