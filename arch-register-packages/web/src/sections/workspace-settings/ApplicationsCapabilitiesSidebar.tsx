import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbApps, TbBolt } from 'react-icons/tb';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import dotStyles from './ApplicationsCapabilitiesSidebar.module.css';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useWorkspaceCapabilityConfigurations } from '../../hooks/useWorkspaceConfig';
import {
  buildApplicationsCapabilitiesItems,
  findApplicationsCapabilitiesItem,
  type ACItem
} from './applicationsCapabilities';

const routeApi = getRouteApi(
  '/authenticated/$workspaceSlug/settings/applications-capabilities'
);

type EnabledState = 'on' | 'warn' | 'off';

const StatusDot = ({ state }: { state: EnabledState }) => (
  <span
    className={`${dotStyles.dot} ${dotStyles[state]}`}
    title={
      state === 'on'
        ? 'Enabled'
        : state === 'warn'
          ? 'Enabled — configuration incomplete'
          : 'Not enabled'
    }
  />
);

export const ApplicationsCapabilitiesSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const ctx = useWorkspaceContext();
  const { data: configurations = [] } = useWorkspaceCapabilityConfigurations(workspaceSlug);

  const stateByType = useMemo(() => {
    const map = new Map<string, EnabledState>();
    for (const config of configurations) {
      map.set(config.type, config.valid ? 'on' : 'warn');
    }
    return map;
  }, [configurations]);

  const perms = {
    canManageBindings: ctx.permissions.canManageWorkspaces,
    canManageAccess: ctx.permissions.canAdministerWorkspace ?? false
  };
  const { applications, capabilities } = buildApplicationsCapabilitiesItems(perms);
  const activeItem = findApplicationsCapabilitiesItem(perms, search.item);

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
            trailing={<StatusDot state={stateByType.get(item.capabilityType) ?? 'off'} />}
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <SidebarTitleHeader title="Applications & Capabilities" />
      <div className={styles.scroll}>
        {renderGroup('Applications', applications, <TbApps size={12} />)}
        {renderGroup('Capabilities', capabilities, <TbBolt size={12} />)}
      </div>
    </>
  );
};
