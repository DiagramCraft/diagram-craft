import { useState, type ReactNode } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../components/Title';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { CapabilityBindingEditor } from './sub-sections/CapabilityBindingEditor';
import { ApplicationAccessCard } from './sub-sections/ApplicationAccessCard';
import {
  findApplicationsCapabilitiesItem,
  resolveApplicationsCapabilitiesTab
} from './applicationsCapabilities';
import { getWorkspaceCapabilityDefinition } from '@arch-register/api-types/integrationCatalog';
import type { WorkspaceApplicationId } from '@arch-register/api-types/workspaceConfigContract';
import styles from './WorkspaceSettingsScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/applications-capabilities');

export const ApplicationsCapabilitiesScreen = () => {
  const navigate = routeApi.useNavigate();
  const params = routeApi.useParams();
  const search = routeApi.useSearch();
  const ctx = useWorkspaceContext();
  const workspaceSlug = params.workspaceSlug;

  const perms = {
    canManageBindings: ctx.permissions.canManageWorkspaces,
    canManageAccess: ctx.permissions.canAdministerWorkspace ?? false
  };

  const item = findApplicationsCapabilitiesItem(perms, search.item);
  const [bindingActions, setBindingActions] = useState<ReactNode>();
  const [accessActions, setAccessActions] = useState<ReactNode>();
  const [enabledControl, setEnabledControl] = useState<ReactNode>();

  const breadcrumb = [
    {
      label: 'Home',
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
    },
    {
      label: 'Settings',
      onClick: () => navigate({ to: '/$workspaceSlug/settings', params: { workspaceSlug } })
    },
    { label: 'Applications & Capabilities' }
  ];

  if (!item || item.tabs.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.head}>
          <Title
            breadcrumb={breadcrumb}
            title="Applications & Capabilities"
            description="No applications or capabilities are available for your current permissions."
          />
        </div>
      </div>
    );
  }

  const activeTab = resolveApplicationsCapabilitiesTab(item, search.tab);
  const bindingSubTab =
    activeTab === 'fields' || activeTab === 'dashboard' ? activeTab : 'bindings';

  const description =
    getWorkspaceCapabilityDefinition(item.capabilityType)?.description ??
    (item.kind === 'application'
      ? 'Configure how this application binds to workspace schemas and who can use it.'
      : 'Bind this capability to the schemas and fields used by this workspace.');

  const selectTab = (tab: string) =>
    navigate({
      to: '/$workspaceSlug/settings/applications-capabilities',
      params: { workspaceSlug },
      search: { item: item.id, tab }
    });

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          breadcrumb={breadcrumb}
          title={item.label}
          description={description}
          buttons={activeTab === 'access' ? accessActions : bindingActions}
        />
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {enabledControl && (
          <div style={{ padding: '0 0 12px' }}>{enabledControl}</div>
        )}

        <Tabs.Root value={activeTab} onValueChange={selectTab}>
          <Tabs.List aria-label={`${item.label} configuration`}>
            {item.tabs.map(tab => (
              <Tabs.Trigger key={tab.id} value={tab.id}>
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        {perms.canManageBindings && (
          <div style={{ display: activeTab === 'access' ? 'none' : undefined }}>
            <CapabilityBindingEditor
              key={item.capabilityType}
              workspaceSlug={workspaceSlug}
              capabilityType={item.capabilityType}
              schemas={ctx.schemas}
              relationSchemas={ctx.relationSchemas}
              subTab={bindingSubTab}
              onActionsChange={setBindingActions}
              onEnabledControlChange={setEnabledControl}
            />
          </div>
        )}

        {activeTab === 'access' && item.applicationId && (
          <ApplicationAccessCard
            workspaceSlug={workspaceSlug}
            applicationId={item.applicationId as Exclude<WorkspaceApplicationId, 'home'>}
            onActionsChange={setAccessActions}
          />
        )}
      </div>
    </div>
  );
};
