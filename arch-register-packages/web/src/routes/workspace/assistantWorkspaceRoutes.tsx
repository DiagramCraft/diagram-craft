import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { validateAssistantSearch } from '../searchParams';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { LazyAssistantScreen, LazyExtractScreen } from './lazyWorkspaceScreens';

export const createAssistantWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  return [
    withWorkspaceShell(
      createRoute({
        getParentRoute: () => workspaceRoute,
        path: 'assistant',
        validateSearch: validateAssistantSearch,
        component: LazyAssistantScreen
      }),
      ctx => ({
        variant: 'full-bleed',
        activeRailItem: 'assistant',
        breadcrumbs: [
          ...buildHomeBreadcrumbs(ctx),
          {
            label: 'AI Assistant',
            onClick: () =>
              ctx.navigate({
                to: '/$workspaceSlug/assistant',
                params: { workspaceSlug: ctx.workspaceSlug }
              })
          }
        ]
      })
    ),
    withWorkspaceShell(
      createRoute({
        getParentRoute: () => workspaceRoute,
        path: 'extract',
        component: LazyExtractScreen
      }),
      ctx => ({
        variant: 'full-bleed',
        activeRailItem: 'extract',
        breadcrumbs: [
          ...buildHomeBreadcrumbs(ctx),
          {
            label: 'AI Extract',
            onClick: () =>
              ctx.navigate({
                to: '/$workspaceSlug/extract',
                params: { workspaceSlug: ctx.workspaceSlug }
              })
          }
        ]
      })
    )
  ] as const;
};
