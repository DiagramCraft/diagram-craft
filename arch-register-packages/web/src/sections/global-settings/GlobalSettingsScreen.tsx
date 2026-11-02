import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { Page } from '../../components/Page';
import { Button } from '@diagram-craft/app-components/Button';
import { GlobalPermissionsSubSection } from './sub-sections/GlobalPermissionsSubSection';
import { SecurityEventsSubSection } from './sub-sections/SecurityEventsSubSection';
import { UsersSubSection } from './sub-sections/UsersSubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useGlobalSettingsSection, type GlobalSettingsSection } from './useGlobalSettingsSection';

const SECTION_META: Record<
  GlobalSettingsSection,
  { title: string; sub: string; buttonLabel: string }
> = {
  'global-permissions': {
    title: 'Global permissions',
    sub: 'Assign platform-wide roles for workspace and platform administration.',
    buttonLabel: 'Add user'
  },
  users: {
    title: 'Users',
    sub: 'Create and manage local user accounts and their authentication details.',
    buttonLabel: 'Create user'
  },
  'security-events': {
    title: 'Security events',
    sub: 'Review sign-ins, failed attempts, rate limiting and account lockouts.',
    buttonLabel: ''
  }
};

export const GlobalSettingsScreen = () => {
  const navigate = useNavigate();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const { section, canManageUsers, authConfigLoaded } = useGlobalSettingsSection();
  const [globalPermissionsAddDialogOpen, setGlobalPermissionsAddDialogOpen] = useState(false);
  const [usersCreateDialogOpen, setUsersCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (section === 'global-permissions' || !authConfigLoaded || canManageUsers) return;
    navigate({
      to: '/$workspaceSlug/settings/global',
      params: { workspaceSlug },
      replace: true
    });
  }, [authConfigLoaded, canManageUsers, navigate, section, workspaceSlug]);

  const meta = SECTION_META[section];

  if (section !== 'global-permissions' && (!authConfigLoaded || !canManageUsers)) return null;

  return (
    <Page>
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
          section === 'security-events' ? undefined : (
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() =>
                section === 'users'
                  ? setUsersCreateDialogOpen(true)
                  : setGlobalPermissionsAddDialogOpen(true)
              }
            >
              {meta.buttonLabel}
            </Button>
          )
        }
      />

      {section === 'security-events' ? (
        <SecurityEventsSubSection />
      ) : section === 'users' ? (
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
    </Page>
  );
};
