import { useMemo } from 'react';
import { useNavigate, useSearch, useLocation } from '@tanstack/react-router';
import {
  TbSettings,
  TbTag,
  TbUsers,
  TbShieldLock,
  TbSparkles,
  TbHistory,
  TbTrash,
  TbCode,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand
} from 'react-icons/tb';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Project } from '@arch-register/api-types/projectContract';

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

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
  { id: 'schemas', label: 'Schemas', icon: <TbCode size={12} />, group: 'Model' },
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
  { id: 'audit', label: 'Audit log', icon: <TbHistory size={12} />, group: 'Workspace' },
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
  const search = useSearch({ strict: false }) as { section?: string };
  const isOnModelOverviewRoute = location.pathname.includes('/settings/model-overview');
  const isOnSchemasRoute = location.pathname.includes('/settings/schemas');
  const section = isOnModelOverviewRoute
    ? 'model-overview'
    : isOnSchemasRoute
      ? 'schemas'
      : (search.section ?? 'general');

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
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root value="settings" onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <div className={styles.headerActions}>
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
        </div>
      </div>
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
            <GroupLabel>{group}</GroupLabel>
            {items.map(s => (
              <TreeRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={section === s.id}
                onClick={() => {
                  if (s.id === 'model-overview') {
                    navigate({
                      to: '/$workspaceSlug/settings/model-overview',
                      params: { workspaceSlug }
                    });
                    return;
                  }

                  if (s.id === 'schemas') {
                    navigate({
                      to: '/$workspaceSlug/settings/schemas',
                      params: { workspaceSlug }
                    });
                    return;
                  }

                  navigate({
                    to: '/$workspaceSlug/settings',
                    params: { workspaceSlug },
                    search: { section: s.id }
                  });
                }}
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
