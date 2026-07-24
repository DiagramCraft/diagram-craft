import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { TbShieldLock } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';

type GlobalSettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
};

const GLOBAL_SETTINGS_SECTIONS: GlobalSettingsNavItem[] = [
  {
    id: 'global-permissions',
    label: 'Global permissions',
    icon: <TbShieldLock size={12} />,
    group: 'Administration'
  }
];

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
      <SidebarTitleHeader title="Global Settings" />
      <div className={styles.scroll}>
        {groups.map(([group, items]) => (
          <div key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            {items.map(s => (
              <TreeRow
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={section === s.id}
                onClick={() =>
                  navigate({
                    to: '/$workspaceSlug/settings/global',
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
