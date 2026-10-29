import type { MouseEvent } from 'react';
import { Link } from '@tanstack/react-router';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { useEntityDrawer } from '../entityDrawer/useEntityDrawer';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import styles from './EntityOverviewTab.module.css';

type EntityProjectAssoc = { project: Project; entity_type: ProjectEntity['entity_type'] };

/** Renders the projects an entity belongs to. */
export const ProjectsBlock = ({ entityProjects }: { entityProjects: EntityProjectAssoc[] }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openProjectDrawer } = useEntityDrawer();

  // Plain left-click opens the project drawer; modified clicks fall through to the real link.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, projectPublicId: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    openProjectDrawer(projectPublicId);
  };

  if (entityProjects.length === 0) {
    return (
      <div className={styles.metaPropRow}>
        <span className={`${styles.metaPropValue} ${styles.metaPropMuted}`}>
          Not in any project
        </span>
      </div>
    );
  }

  return entityProjects.map(({ project, entity_type }) => (
    <div key={project.id} className={styles.projectRow}>
      <Link
        {...projectDetailRoute(workspaceSlug, asProjectPublicId(project.public_id))}
        className={styles.projectLink}
        onClick={event => handleClick(event, project.public_id)}
      >
        {project.name}
      </Link>
      <span className={styles.metaPropValue}>
        {entity_type ? entity_type.name : <span className={styles.metaPropMuted}>—</span>}
      </span>
    </div>
  ));
};
