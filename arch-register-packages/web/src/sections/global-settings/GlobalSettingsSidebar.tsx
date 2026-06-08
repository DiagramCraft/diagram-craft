import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { TbShieldLock } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

type GlobalSettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
};

const GLOBAL_SETTINGS_SECTIONS: GlobalSettingsNavItem[] = [
  { id: 'global-permissions', label: 'Global permissions', icon: <TbShieldLock size={12} />, group: 'Administration' },
];

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

const SectionHeader = ({ title }: { title: string }) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    <Tabs.Root value="section">
      <Tabs.List>
        <Tabs.Trigger value="section">{title}</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </div>
);

export const GlobalSettingsSidebar = () => {
  const navigate = useNavigate();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const section = 'global-permissions'; // Currently only one section

  const groups = useMemo(() => {
    const g: Record<string, GlobalSettingsNavItem[]> = {};
    GLOBAL_SETTINGS_SECTIONS.forEach(s => {
      (g[s.group] ??= []).push(s);
    });
    return Object.entries(g);
  }, []);

  return (
    <div className={styles.panel}>
      <SectionHeader title="Global Settings" />
      <div className={styles.scroll}>
        {groups.map(([group, items]) => (
          <div key={group}>
            <GroupLabel>{group}</GroupLabel>
            {items.map(s => (
              <TreeRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={section === s.id}
                onClick={() => navigate({ 
                  to: '/$workspaceSlug/settings/global',
                  params: { workspaceSlug }
                })}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
