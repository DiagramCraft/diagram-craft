import { useState } from 'react';
import styles from '../workspace-settings/WorkspaceSettingsScreen.module.css';
import { useNavigate } from '@tanstack/react-router';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { GlobalPermissionsSubSection } from './sub-sections/GlobalPermissionsSubSection';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

const SECTION_META: Record<string, { title: string; sub: string }> = {
  'global-permissions': {
    title: 'Global permissions',
    sub: 'Assign platform-wide roles for workspace and platform administration.'
  }
};

export const GlobalSettingsScreen = () => {
  const navigate = useNavigate();
  const ctx = useWorkspaceContext();
  const workspaceSlug = ctx.workspaceSlug;
  const [globalPermissionsAddDialogOpen, setGlobalPermissionsAddDialogOpen] = useState(false);

  // For now, we only have one section, but this structure allows for future expansion
  const section = 'global-permissions';
  const meta = SECTION_META[section] ?? SECTION_META['global-permissions']!;

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
              onClick={() => setGlobalPermissionsAddDialogOpen(true)}
            >
              Add user
            </Button>
          }
        />
      </div>

      <GlobalPermissionsSubSection
        addDialogOpen={globalPermissionsAddDialogOpen}
        onCloseAddDialog={() => setGlobalPermissionsAddDialogOpen(false)}
      />
    </div>
  );
};
