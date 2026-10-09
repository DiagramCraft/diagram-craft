import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { TbApps, TbBolt, TbPlus } from 'react-icons/tb';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useApplications, useCreateApplication } from '../../hooks/useApplications';
import { AddApplicationDialog } from './AddApplicationDialog';
import { useWorkspaceCapabilityConfigurations } from '../../hooks/useWorkspaceConfig';
import dotStyles from './ApplicationsCapabilitiesSidebar.module.css';
import {
  buildApplicationsCapabilitiesItems,
  findApplicationsCapabilitiesItem,
  type ACItem
} from './applicationsCapabilities';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/applications-capabilities');

type EnabledState = 'on' | 'warn' | 'off';

const StatusDot = ({ state }: { state: EnabledState }) => (
  <span
    className={`${dotStyles.dot} ${dotStyles[state]}`}
    title={
      state === 'on'
        ? 'Configured'
        : state === 'warn'
          ? 'Configuration incomplete'
          : 'Not configured'
    }
  />
);

export const ApplicationsCapabilitiesSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const ctx = useWorkspaceContext();
  const { data: workspaceApplications = [] } = useApplications(workspaceSlug);
  const createApplication = useCreateApplication(workspaceSlug);
  const [addOpen, setAddOpen] = useState(false);
  const { data: configurations = [] } = useWorkspaceCapabilityConfigurations(workspaceSlug);
  const stateByType = useMemo(() => {
    const map = new Map<string, EnabledState>();
    for (const config of configurations) map.set(config.type, config.valid ? 'on' : 'warn');
    return map;
  }, [configurations]);

  const perms = {
    canManageBindings: ctx.permissions.canManageWorkspaces,
    canManageAccess: ctx.permissions.canAdministerWorkspace ?? false,
    canManageApplications: ctx.permissions.canManageDashboard
  };
  const { applications, capabilities } = buildApplicationsCapabilitiesItems(
    perms,
    workspaceApplications
  );
  const activeItem = findApplicationsCapabilitiesItem(perms, workspaceApplications, search.item);

  const select = (id: string) =>
    navigate({
      to: '/$workspaceSlug/settings/applications-capabilities',
      params: { workspaceSlug },
      search: { item: id }
    });

  const renderGroup = (label: string, items: ACItem[], icon: React.ReactNode) =>
    items.length > 0 ? (
      <>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        {items.map(item => (
          <TreeRow
            key={item.id}
            icon={icon}
            label={item.label}
            active={activeItem?.id === item.id}
            onClick={() => select(item.id)}
            trailing={
              item.capabilityType ? (
                <StatusDot state={stateByType.get(item.capabilityType) ?? 'off'} />
              ) : undefined
            }
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <SidebarTitleHeader
        title="Applications & Capabilities"
        actions={
          perms.canManageApplications ? (
            <button
              type="button"
              className={styles.action}
              title="Add application"
              onClick={() => setAddOpen(true)}
            >
              <TbPlus size={13} />
            </button>
          ) : undefined
        }
      />
      <AddApplicationDialog
        key={`add-${addOpen}`}
        open={addOpen}
        error={
          createApplication.error instanceof Error ? createApplication.error.message : undefined
        }
        onCancel={() => setAddOpen(false)}
        onConfirm={application =>
          createApplication.mutate(application, {
            onSuccess: created => {
              setAddOpen(false);
              void navigate({
                to: '/$workspaceSlug/settings/applications-capabilities',
                params: { workspaceSlug },
                search: { item: created.key }
              });
            }
          })
        }
      />
      <div className={styles.scroll}>
        {renderGroup('Applications', applications, <TbApps size={12} />)}
        {renderGroup('Capabilities', capabilities, <TbBolt size={12} />)}
      </div>
    </>
  );
};
