import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { buildGlossaryBreadcrumbs, GLOSSARY_RAIL_ITEM_ID } from './glossaryShell';
import { withWorkspaceShell } from '../../routes/workspace/workspaceShellRoute';
import { railSectionShell } from '../../layouts/workspaceShellDescriptors';
import { validateGlossarySearch } from '../../routes/searchParams';
import { LazyGlossaryScreen } from '../../routes/workspace/lazyWorkspaceScreens';
import { ensureApplicationAccess } from '../../routes/applicationAccess';

export const createGlossaryWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const glossaryRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'glossary',
      validateSearch: validateGlossarySearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'business-glossary'
        ),
      component: LazyGlossaryScreen
    }),
    ctx =>
      railSectionShell(ctx, GLOSSARY_RAIL_ITEM_ID, {
        breadcrumbs: buildGlossaryBreadcrumbs(ctx)
      })
  );
  const glossaryTermRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'glossary/$termId',
      validateSearch: validateGlossarySearch,
      beforeLoad: ({ context, params }) =>
        ensureApplicationAccess(
          context.queryClient,
          (params as unknown as { workspaceSlug: string }).workspaceSlug,
          'business-glossary'
        ),
      // Renders the same GlossaryScreen (list) with the term opened as a slide-over drawer on
      // top, rather than a separate page — keeps the deep-linkable /glossary/$termId URL while
      // matching the Claude Design mockup's drawer interaction.
      component: LazyGlossaryScreen
    }),
    ctx =>
      railSectionShell(ctx, GLOSSARY_RAIL_ITEM_ID, {
        breadcrumbs: buildGlossaryBreadcrumbs(ctx, true)
      })
  );
  return [glossaryRoute, glossaryTermRoute] as const;
};
