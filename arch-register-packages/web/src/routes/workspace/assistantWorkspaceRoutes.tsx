import { createRoute } from '@tanstack/react-router';
import { AssistantScreen } from '../../sections/ai-assistant/AssistantScreen';
import { ExtractScreen } from '../../sections/ai-extract/ExtractScreen';
import { validateAssistantSearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildHomeBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createAssistantWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  return [
    {
      route: createRoute({
        getParentRoute: () => workspaceRoute,
        path: 'assistant',
        validateSearch: validateAssistantSearch,
        component: AssistantScreen
      }),
      matchesRouteId: routeId => routeId.endsWith('/assistant'),
      buildShell: ctx => ({
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
    },
    {
      route: createRoute({
        getParentRoute: () => workspaceRoute,
        path: 'extract',
        component: ExtractScreen
      }),
      matchesRouteId: routeId => routeId.endsWith('/extract'),
      buildShell: ctx => ({
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
    }
  ];
};
