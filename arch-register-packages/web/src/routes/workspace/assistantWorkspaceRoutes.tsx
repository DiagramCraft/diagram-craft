import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { AssistantScreen } from '../../sections/ai-assistant/AssistantScreen';
import { ExtractScreen } from '../../sections/ai-extract/ExtractScreen';
import { validateAssistantSearch } from '../searchParams';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createAssistantWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  return [
    withWorkspaceShell(
      createRoute({
        getParentRoute: () => workspaceRoute,
        path: 'assistant',
        validateSearch: validateAssistantSearch,
        component: AssistantScreen
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
        component: ExtractScreen
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
