import { Button } from '@diagram-craft/app-components/Button';
import { TbFolders, TbPlus } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './ProjectDetailScreen.module.css';

export const ProjectsScreen = () => {
  const { projects, openAddProjectDialog, permissions } = useWorkspaceContext();

  return (
    <div className={styles.screen}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <TbFolders size={22} />
        </div>
        <div className={styles.emptyTitle}>Select a project</div>
        <div className={styles.emptySub}>
          Choose a project from the sidebar to view diagrams, entities, and details.
        </div>
        {projects.length === 0 && permissions.canCreateProjects && (
          <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddProjectDialog}>
            New project
          </Button>
        )}
      </div>
    </div>
  );
};
