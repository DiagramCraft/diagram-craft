import { useMemo } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import {
  TbChartBar,
  TbSettings,
  TbTag,
  TbUsers,
  TbShieldLock,
  TbSparkles,
  TbHistory,
  TbTrash,
  TbCode,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
  TbFileExport,
  TbActivity,
  TbWebhook,
  TbFileDescription
} from 'react-icons/tb';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Project } from '@arch-register/api-types/projectContract';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { settingsSectionTarget } from '../../routes/settingsNavigation';

type SettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  tone?: string;
};

const SETTINGS_SECTIONS: SettingsNavItem[] = [
  { id: 'general', label: 'General', icon: <TbSettings size={12} />, group: 'Workspace' },
  { id: 'lifecycle-owners', label: 'Lifecycle', icon: <TbTag size={12} />, group: 'Workspace' },
  { id: 'model-overview', label: 'Model Overview', icon: <TbCode size={12} />, group: 'Model' },
  { id: 'schemas', label: 'Entity Types', icon: <TbCode size={12} />, group: 'Model' },
  {
    id: 'documents',
    label: 'Document Types & Templates',
    icon: <TbFileDescription size={12} />,
    group: 'Model'
  },
  { id: 'members', label: 'Members', icon: <TbUsers size={12} />, group: 'People' },
  { id: 'teams', label: 'Teams', icon: <TbUsers size={12} />, group: 'People' },
  { id: 'roles', label: 'Roles & permissions', icon: <TbShieldLock size={12} />, group: 'People' },
  {
    id: 'global-permissions',
    label: 'Global permissions',
    icon: <TbShieldLock size={12} />,
    group: 'Global Settings'
  },
  { id: 'ai', label: 'AI', icon: <TbSparkles size={12} />, group: 'Workspace' },
  {
    id: 'export-import',
    label: 'Export & Import',
    icon: <TbFileExport size={12} />,
    group: 'Workspace'
  },
  { id: 'analytics', label: 'Analytics', icon: <TbChartBar size={12} />, group: 'Workspace' },
  { id: 'audit', label: 'Audit log', icon: <TbHistory size={12} />, group: 'Workspace' },
  { id: 'webhooks', label: 'Webhooks', icon: <TbWebhook size={12} />, group: 'Workspace' },
  { id: 'jobs', label: 'Job monitoring', icon: <TbActivity size={12} />, group: 'Workspace' },
  {
    id: 'danger',
    label: 'Danger zone',
    icon: <TbTrash size={12} />,
    group: 'Workspace',
    tone: 'danger'
  }
];

export const WorkspaceSettingsSidebar = ({
  workspace,
  workspaceSlug,
  schemas,
  projects,
  availableSections,
  onCollapse,
  onExpand
}: {
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  projects: Project[];
  availableSections: string[];
  onCollapse?: () => void;
  onExpand?: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.split('/').pop() || 'general';

  const groups = useMemo(() => {
    const g: Record<string, SettingsNavItem[]> = {};
    SETTINGS_SECTIONS.filter(s => availableSections.includes(s.id)).forEach(s => {
      (g[s.group] ??= []).push(s);
    });
    return Object.entries(g);
  }, [availableSections]);

  const entityCount = schemas.reduce((sum, s) => sum + s.entity_count, 0);

  return (
    <>
      <SidebarHeader
        actions={
          <>
            {onCollapse && (
              <button
                type="button"
                className={styles.action}
                title="Collapse to rail"
                onClick={onCollapse}
              >
                <TbLayoutSidebarLeftCollapse size={14} />
              </button>
            )}
            {onExpand && (
              <button
                type="button"
                className={styles.action}
                title="Pin sidebar open"
                onClick={onExpand}
              >
                <TbLayoutSidebarLeftExpand size={14} />
              </button>
            )}
          </>
        }
      >
        <Tabs.Root value="settings" onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      <div className={styles.scroll}>
        {workspace && (
          <div className={styles.settingsWsHead}>
            <div className={styles.settingsWsBadge}>{workspace.short_code}</div>
            <div>
              <div className={styles.settingsWsName}>{workspace.name}</div>
              <div className="dim" style={{ fontSize: 11 }}>
                {entityCount} entities · {projects.length} projects
              </div>
            </div>
          </div>
        )}
        {groups.map(([group, items]) => (
          <div key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            {items.map(s => (
              <TreeRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={section === s.id}
                onClick={() => navigate(settingsSectionTarget(workspaceSlug, s.id))}
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
