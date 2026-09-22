import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
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
  // Legacy deep link: `GlossaryScreen` now opens the term drawer via the shared `drawer` search
  // param (see useEntityDrawer.ts) instead of a `$termId` route, so an old bookmarked
  // `.../glossary/$termId` URL is redirected to the equivalent search param.
  const glossaryTermRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'glossary/$termId',
    beforeLoad: ({ params }) => {
      const { workspaceSlug, termId } = params as unknown as {
        workspaceSlug: string;
        termId: string;
      };
      throw redirect({
        to: '/$workspaceSlug/glossary',
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({ ...previous, drawer: termId })
      });
    }
  });
  return [glossaryRoute, glossaryTermRoute] as const;
};
