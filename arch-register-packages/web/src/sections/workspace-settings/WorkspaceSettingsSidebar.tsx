import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  TbSettings,
  TbTag,
  TbUsers,
  TbShieldLock,
  TbSparkles,
  TbHistory,
  TbTrash
} from 'react-icons/tb';
import type { EntitySchema, Project } from '../../lib/api';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';

const SectionHeader = ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
    </div>
    {actions && <div className={styles.headerActions}>{actions}</div>}
  </div>
);

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
  availableSections
}: {
  workspace: import('../../lib/api').Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  projects: Project[];
  availableSections: string[];
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: string };
  const section = search.section ?? 'general';

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
      <SectionHeader title="Settings" />
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
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/settings',
                    params: { workspaceSlug },
                    search: { section: s.id }
                  })
                }
                className={s.tone === 'danger' ? styles.dangerRow : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
};
