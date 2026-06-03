import { useState } from 'react';
import styles from './WorkspaceSettings.module.css';
import { useNavigate } from '@tanstack/react-router';
import { TbChevronLeft, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { GlobalPermissionsSection } from './GlobalPermissionsSection';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';

const SECTION_META: Record<string, { title: string; sub: string }> = {
  'global-permissions': { 
    title: 'Global permissions', 
    sub: 'Assign platform-wide roles for workspace and platform administration.' 
  },
};

export const GlobalSettings = () => {
  const navigate = useNavigate();
  const ctx = useWorkspaceContext();
  const workspace = ctx.workspace!;
  const workspaceSlug = ctx.workspaceSlug;
  const [globalPermissionsAddDialogOpen, setGlobalPermissionsAddDialogOpen] = useState(false);
  
  // For now, we only have one section, but this structure allows for future expansion
  const section = 'global-permissions';
  const meta = SECTION_META[section] ?? SECTION_META['global-permissions']!;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <button 
            type="button" 
            className={styles.backLink} 
            onClick={() => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })}
          >
            <TbChevronLeft size={12} /> {workspace.name}
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Global settings</span>
          <div className={styles.titleRow}>
            <div className={styles.title}>{meta.title}</div>
          </div>
          <div className={styles.sub}>{meta.sub}</div>
        </div>
        <div className={styles.headActions}>
          <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setGlobalPermissionsAddDialogOpen(true)}>
            Add user
          </Button>
        </div>
      </div>

      <GlobalPermissionsSection
        addDialogOpen={globalPermissionsAddDialogOpen}
        onCloseAddDialog={() => setGlobalPermissionsAddDialogOpen(false)}
      />
    </div>
  );
};
