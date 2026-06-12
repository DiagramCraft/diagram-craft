import { createRoute } from '@tanstack/react-router';
import { WorkspaceSettingsScreen } from '../../sections/workspace-settings/WorkspaceSettingsScreen';
import { GlobalSettingsScreen } from '../../sections/global-settings/GlobalSettingsScreen';
import { AccountSettingsScreen } from '../../sections/account-settings/AccountSettingsScreen';
import { WorkspaceSettingsSidebar } from '../../sections/workspace-settings/WorkspaceSettingsSidebar';
import { GlobalSettingsSidebar } from '../../sections/global-settings/GlobalSettingsSidebar';
import { AccountSettingsSidebar } from '../../sections/account-settings/AccountSettingsSidebar';
import { validateSettingsSearch } from '../searchParams';
import type { WorkspaceShellEntry } from '../workspaceShellRegistry';
import { buildSettingsBreadcrumbs } from '../../layouts/workspaceShellDescriptors';

export const createSettingsWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): WorkspaceShellEntry[] => {
  const settingsRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings',
    validateSearch: validateSettingsSearch,
    component: WorkspaceSettingsScreen
  });

  const globalSettingsRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings/global',
    component: GlobalSettingsScreen
  });

  const accountSettingsRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'account',
    component: AccountSettingsScreen
  });

  return [
    {
      route: settingsRoute,
      matchesRouteId: routeId => routeId.endsWith('/settings'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: null,
        breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Settings', '/$workspaceSlug/settings'),
        primarySidebar: (
          <WorkspaceSettingsSidebar
            workspaceSlug={ctx.workspaceSlug}
            workspace={ctx.workspace}
            schemas={ctx.schemas}
            projects={ctx.projects}
            availableSections={ctx.availableSettingsSections}
          />
        )
      })
    },
    {
      route: globalSettingsRoute,
      matchesRouteId: routeId => routeId.endsWith('/settings/global'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: null,
        breadcrumbs: buildSettingsBreadcrumbs(
          ctx,
          'Global Settings',
          '/$workspaceSlug/settings/global'
        ),
        primarySidebar: <GlobalSettingsSidebar />
      })
    },
    {
      route: accountSettingsRoute,
      matchesRouteId: routeId => routeId.endsWith('/account'),
      buildShell: ctx => ({
        variant: 'standard',
        activeRailItem: null,
        breadcrumbs: buildSettingsBreadcrumbs(
          ctx,
          'Account Settings',
          '/$workspaceSlug/account'
        ),
        primarySidebar: <AccountSettingsSidebar />
      })
    }
  ];
};
