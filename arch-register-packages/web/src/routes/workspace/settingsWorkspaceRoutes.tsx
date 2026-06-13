import { createRoute } from '@tanstack/react-router';
import { WorkspaceSettingsScreen } from '../../sections/workspace-settings/WorkspaceSettingsScreen';
import { SchemaSettingsScreen } from '../../sections/workspace-settings/SchemaSettingsScreen';
import { SchemaGraphView } from '../../sections/workspace-settings/SchemaGraphView';
import { GlobalSettingsScreen } from '../../sections/global-settings/GlobalSettingsScreen';
import { AccountSettingsScreen } from '../../sections/account-settings/AccountSettingsScreen';
import { WorkspaceSettingsSidebar } from '../../sections/workspace-settings/WorkspaceSettingsSidebar';
import { SchemaSettingsSidebar } from '../../sections/workspace-settings/SchemaSettingsSidebar';
import { GlobalSettingsSidebar } from '../../sections/global-settings/GlobalSettingsSidebar';
import { AccountSettingsSidebar } from '../../sections/account-settings/AccountSettingsSidebar';
import { validateSettingsSearch, validateSchemaSettingsSearch } from '../searchParams';
import { buildSettingsBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createSettingsWorkspaceRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const settingsRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings',
    validateSearch: validateSettingsSearch,
    component: WorkspaceSettingsScreen
  }), ctx => ({
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
  }));

  const globalSettingsRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings/global',
    component: GlobalSettingsScreen
  }), ctx => ({
    variant: 'standard',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(
      ctx,
      'Global Settings',
      '/$workspaceSlug/settings/global'
    ),
    primarySidebar: <GlobalSettingsSidebar />
  }));

  const schemaSettingsRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings/schemas',
    validateSearch: validateSchemaSettingsSearch,
    component: SchemaSettingsScreen
  }), ctx => ({
    variant: 'detail',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Settings', '/$workspaceSlug/settings'),
    navigationLabel: 'Settings',
    renderNavigation: controls => (
      <WorkspaceSettingsSidebar
        workspaceSlug={ctx.workspaceSlug}
        workspace={ctx.workspace}
        schemas={ctx.schemas}
        projects={ctx.projects}
        availableSections={ctx.availableSettingsSections}
        onCollapse={controls.expanded ? controls.collapse : undefined}
        onExpand={controls.expanded ? undefined : controls.expand}
      />
    ),
    secondarySidebar: (
      <SchemaSettingsSidebar
        schemas={ctx.schemas}
        enums={ctx.enums}
        workspaceSlug={ctx.workspaceSlug}
      />
    )
  }));

  const modelOverviewRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'settings/model-overview',
    component: SchemaGraphView
  }), ctx => ({
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
  }));

  const accountSettingsRoute = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'account',
    component: AccountSettingsScreen
  }), ctx => ({
    variant: 'standard',
    activeRailItem: null,
    breadcrumbs: buildSettingsBreadcrumbs(
      ctx,
      'Account Settings',
      '/$workspaceSlug/account'
    ),
    primarySidebar: <AccountSettingsSidebar />
  }));

  return [
    settingsRoute,
    schemaSettingsRoute,
    modelOverviewRoute,
    globalSettingsRoute,
    accountSettingsRoute
  ];
};
