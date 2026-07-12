import { Button } from '@diagram-craft/app-components/Button';
import { TbFolders, TbPlus } from 'react-icons/tb';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EmptyState } from '../../components/EmptyState';
import styles from './ProjectDetailScreen.module.css';

export const ProjectsScreen = () => {
  const { projects, openAddProjectDialog, permissions } = useWorkspaceContext();

  return (
    <div className={styles.screen}>
      <EmptyState
        framed
        icon={<TbFolders size={22} />}
        title="Select a project"
        subtitle="Choose a project from the sidebar to view diagrams, entities, and details."
        action={
          projects.length === 0 &&
          permissions.canCreateProjects && (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={openAddProjectDialog}>
              New project
            </Button>
          )
        }
      />
    </div>
  );
};
