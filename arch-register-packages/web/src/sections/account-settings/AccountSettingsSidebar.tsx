import { useNavigate, useLocation } from '@tanstack/react-router';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { ACCOUNT_SECTIONS, resolveAccountSection } from './accountSections';

export const AccountSettingsSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceSlug } = useWorkspaceContext();
  const activeId = resolveAccountSection(location.pathname.split('/').pop()).id;

  return (
    <div className={styles.panel}>
      <SidebarTitleHeader title="Account Settings" />
      <div className={styles.scroll}>
        <SidebarGroupLabel>Account</SidebarGroupLabel>
        {ACCOUNT_SECTIONS.map(s => (
          <TreeRow
            key={s.id}
            icon={s.icon}
            label={s.label}
            active={activeId === s.id}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/account/$section',
                params: { workspaceSlug, section: s.id }
              })
            }
          />
        ))}
      </div>
    </div>
  );
};
