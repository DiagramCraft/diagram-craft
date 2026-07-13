import { createRoute, useNavigate, useSearch, type AnyRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { WorkspaceSettingsSidebar } from '../../sections/workspace-settings/WorkspaceSettingsSidebar';
import { SchemaSettingsSidebar } from '../../sections/workspace-settings/SchemaSettingsSidebar';
import { GlobalSettingsSidebar } from '../../sections/global-settings/GlobalSettingsSidebar';
import { AccountSettingsSidebar } from '../../sections/account-settings/AccountSettingsSidebar';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { AuditOperation } from '@arch-register/api-types/auditContract';
import {
  validateModelOverviewSearch,
  validateSettingsSearch,
  validateLegacySettingsSearch,
  validateSchemaSettingsSearch
} from '../searchParams';
import { buildSettingsBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';
import { settingsSectionTarget } from '../settingsNavigation';
import {
  LazyAccountSettingsScreen,
  LazyGlobalSettingsScreen,
  LazySchemaGraphView,
  LazySchemaSettingsScreen,
  LazyWorkspaceSettingsScreen
} from './lazyWorkspaceScreens';

const SettingsRedirect = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    section?: string;
    auditEntityType?: string;
    auditOperation?: AuditOperation;
    auditStartDate?: string;
    auditEndDate?: string;
    analyticsView?: 'stale';
  };
  const ctx = useWorkspaceContext();

  useEffect(() => {
    const { section, ...rest } = search;
    const target = ctx.availableSettingsSections.includes(section ?? '')
      ? section!
      : (ctx.defaultSettingsSection ?? 'general');
    navigate({
      ...settingsSectionTarget(ctx.workspaceSlug, target),
      search: rest,
      replace: true
    });
  }, [navigate, ctx, search]);

  return null;
};

const AccountSettingsRedirect = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: string };
  const ctx = useWorkspaceContext();

  useEffect(() => {
    const target = search.section === 'appearance' ? 'appearance' : 'profile';
    navigate({
      to: '/$workspaceSlug/account/$section',
      params: { workspaceSlug: ctx.workspaceSlug, section: target },
      replace: true
    });
  }, [navigate, ctx, search.section]);

  return null;
};

export const createSettingsWorkspaceRoutes = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const settingsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'settings',
      validateSearch: validateLegacySettingsSearch,
      component: SettingsRedirect
    }),
    ctx => ({
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
  );

  const settingsSectionRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'settings/$section',
      validateSearch: validateSettingsSearch,
      component: LazyWorkspaceSettingsScreen
    }),
    ctx => ({
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
  );

  const globalSettingsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'settings/global',
      component: LazyGlobalSettingsScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: null,
      breadcrumbs: buildSettingsBreadcrumbs(
        ctx,
        'Global Settings',
        '/$workspaceSlug/settings/global'
      ),
      primarySidebar: <GlobalSettingsSidebar />
    })
  );

  const schemaSettingsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'settings/schemas',
      validateSearch: validateSchemaSettingsSearch,
      component: LazySchemaSettingsScreen
    }),
    ctx => ({
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
    })
  );

  const modelOverviewRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'settings/model-overview',
      validateSearch: validateModelOverviewSearch,
      component: LazySchemaGraphView
    }),
    ctx => ({
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
  );

  const accountSettingsRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'account',
      component: AccountSettingsRedirect
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: null,
      breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Account Settings', '/$workspaceSlug/account'),
      primarySidebar: <AccountSettingsSidebar />
    })
  );

  const accountSectionRoute = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'account/$section',
      component: LazyAccountSettingsScreen
    }),
    ctx => ({
      variant: 'standard',
      activeRailItem: null,
      breadcrumbs: buildSettingsBreadcrumbs(ctx, 'Account Settings', '/$workspaceSlug/account'),
      primarySidebar: <AccountSettingsSidebar />
    })
  );

  return [
    settingsRoute,
    settingsSectionRoute,
    schemaSettingsRoute,
    modelOverviewRoute,
    globalSettingsRoute,
    accountSettingsRoute,
    accountSectionRoute
  ] as const;
};
