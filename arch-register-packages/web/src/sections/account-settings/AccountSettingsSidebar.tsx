import { useMemo } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { TbPalette, TbUser } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../components/sidebar/SidebarPrimitives';

type AccountSettingsNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
};

const ACCOUNT_SETTINGS_SECTIONS: AccountSettingsNavItem[] = [
  { id: 'profile', label: 'Profile', icon: <TbUser size={12} />, group: 'Account' },
  { id: 'appearance', label: 'Appearance', icon: <TbPalette size={12} />, group: 'Account' },
];

export const AccountSettingsSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const activeSegment = location.pathname.split('/').pop();
  const section = ACCOUNT_SETTINGS_SECTIONS.some(item => item.id === activeSegment)
    ? activeSegment
    : 'profile';

  const groups = useMemo(() => {
    const g: Record<string, AccountSettingsNavItem[]> = {};
    ACCOUNT_SETTINGS_SECTIONS.forEach(s => {
      (g[s.group] ??= []).push(s);
    });
    return Object.entries(g);
  }, []);

  return (
    <div className={styles.panel}>
      <SidebarTitleHeader title="Account Settings" />
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
                    to: '/$workspaceSlug/account/$section',
                    params: { workspaceSlug, section: s.id },
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
