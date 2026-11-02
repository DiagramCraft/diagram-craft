import { useState, type ReactNode } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../components/Title';
import { Page } from '../../components/Page';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useApplications } from '../../hooks/useApplications';
import { CapabilityBindingEditor } from './sub-sections/CapabilityBindingEditor';
import { ApplicationAccessCard } from './sub-sections/ApplicationAccessCard';
import { ApplicationAuxMenu } from './sub-sections/ApplicationAuxMenu';
import { ApplicationGeneralCard } from './sub-sections/ApplicationGeneralCard';
import {
  findApplicationsCapabilitiesItem,
  resolveApplicationsCapabilitiesTab
} from './applicationsCapabilities';
import { getWorkspaceCapabilityDefinition } from '@arch-register/api-types/integrationCatalog';
import type { WorkspaceApplicationId } from '@arch-register/api-types/workspaceConfigContract';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/applications-capabilities');

export const ApplicationsCapabilitiesScreen = () => {
  const navigate = routeApi.useNavigate();
  const params = routeApi.useParams();
  const search = routeApi.useSearch();
  const ctx = useWorkspaceContext();
  const workspaceSlug = params.workspaceSlug;
  const { data: workspaceApplications = [] } = useApplications(workspaceSlug);

  const perms = {
    canManageBindings: ctx.permissions.canManageWorkspaces,
    canManageAccess: ctx.permissions.canAdministerWorkspace ?? false,
    canManageApplications: ctx.permissions.canManageDashboard
  };

  const item = findApplicationsCapabilitiesItem(perms, workspaceApplications, search.item);
  const [bindingActions, setBindingActions] = useState<ReactNode>();
  const [generalActions, setGeneralActions] = useState<ReactNode>();
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
      <Title
        breadcrumb={breadcrumb}
        title="Applications & Capabilities"
        description="No applications or capabilities are available for your current permissions."
      />
    );
  }

  const activeTab = resolveApplicationsCapabilitiesTab(item, search.tab);

  const description =
    (item.capabilityType
      ? getWorkspaceCapabilityDefinition(item.capabilityType)?.description
      : undefined) ?? 'Control who can use this application.';

  const selectTab = (tab: string) =>
    navigate({
      to: '/$workspaceSlug/settings/applications-capabilities',
      params: { workspaceSlug },
      search: { item: item.id, tab }
    });

  return (
    <Page>
      <Title
        breadcrumb={breadcrumb}
        title={item.label}
        description={description}
        toggleButtons={enabledControl}
        menu={
          item.kind === 'application' && item.applicationId ? (
            <ApplicationAuxMenu
              workspaceSlug={workspaceSlug}
              applicationKey={item.applicationId}
              onDeleted={() =>
                navigate({
                  to: '/$workspaceSlug/settings/applications-capabilities',
                  params: { workspaceSlug },
                  search: {}
                })
              }
            />
          ) : undefined
        }
        buttons={
          item.kind === 'application'
            ? activeTab === 'general'
              ? generalActions
              : accessActions
            : bindingActions
        }
      />

      <Tabs.Root autoHeight value={activeTab} onValueChange={selectTab}>
        <Tabs.List aria-label={`${item.label} configuration`}>
          {item.tabs.map(tab => (
            <Tabs.Trigger key={tab.id} value={tab.id}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {item.kind === 'capability' && item.capabilityType && perms.canManageBindings && (
          <Tabs.Content value="bindings">
            <CapabilityBindingEditor
              key={item.capabilityType}
              workspaceSlug={workspaceSlug}
              capabilityType={item.capabilityType}
              schemas={ctx.schemas}
              relationSchemas={ctx.relationSchemas}
              onActionsChange={setBindingActions}
              onEnabledControlChange={setEnabledControl}
            />
          </Tabs.Content>
        )}

        {item.kind === 'application' && item.applicationId && (
          <>
            <Tabs.Content value="general">
              <ApplicationGeneralCard
                key={item.applicationId}
                workspaceSlug={workspaceSlug}
                applicationKey={item.applicationId}
                onActionsChange={setGeneralActions}
              />
            </Tabs.Content>
            <Tabs.Content value="access">
              <ApplicationAccessCard
                workspaceSlug={workspaceSlug}
                applicationId={item.applicationId as Exclude<WorkspaceApplicationId, 'home'>}
                onActionsChange={setAccessActions}
              />
            </Tabs.Content>
          </>
        )}
      </Tabs.Root>
    </Page>
  );
};
