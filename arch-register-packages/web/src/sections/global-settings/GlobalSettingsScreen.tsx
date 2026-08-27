import { useEffect, useState } from 'react';
import styles from '../workspace-settings/WorkspaceSettingsScreen.module.css';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { GlobalPermissionsSubSection } from './sub-sections/GlobalPermissionsSubSection';
import { UsersSubSection } from './sub-sections/UsersSubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useAuthConfig } from '../../hooks/useAuthConfig';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';

const SECTION_META: Record<string, { title: string; sub: string }> = {
  'global-permissions': {
    title: 'Global permissions',
    sub: 'Assign platform-wide roles for workspace and platform administration.'
  },
  users: {
    title: 'Users',
    sub: 'Create and manage local user accounts and their authentication details.'
  }
};

export const GlobalSettingsScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const { data: authConfig } = useAuthConfig();
  const { hasGlobalPermission } = useWorkspaceAuthorization(ctx.workspace?.id);
  const [globalPermissionsAddDialogOpen, setGlobalPermissionsAddDialogOpen] = useState(false);
  const [usersCreateDialogOpen, setUsersCreateDialogOpen] = useState(false);

  const section = location.pathname.endsWith('/users') ? 'users' : 'global-permissions';
  const canManageUsers =
    authConfig != null && authConfig.mode !== 'oidc' && hasGlobalPermission('admin_platform');

  useEffect(() => {
    if (section !== 'users' || authConfig == null || canManageUsers) return;
    navigate({
      to: '/$workspaceSlug/settings/global',
      params: { workspaceSlug },
      replace: true
    });
  }, [authConfig, canManageUsers, navigate, section, workspaceSlug]);

  const meta = SECTION_META[section] ?? SECTION_META['global-permissions']!;

  if (section === 'users' && (authConfig == null || !canManageUsers)) return null;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            },
            { label: 'Settings' }
          ]}
          title={meta.title}
          description={meta.sub}
          buttons={
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() =>
                section === 'users'
                  ? setUsersCreateDialogOpen(true)
                  : setGlobalPermissionsAddDialogOpen(true)
              }
            >
              Add user
            </Button>
          }
        />
      </div>

      {section === 'users' ? (
        <UsersSubSection
          createDialogOpen={usersCreateDialogOpen}
          onCloseCreateDialog={() => setUsersCreateDialogOpen(false)}
        />
      ) : (
        <GlobalPermissionsSubSection
          addDialogOpen={globalPermissionsAddDialogOpen}
          onCloseAddDialog={() => setGlobalPermissionsAddDialogOpen(false)}
        />
      )}
    </div>
  );
};
