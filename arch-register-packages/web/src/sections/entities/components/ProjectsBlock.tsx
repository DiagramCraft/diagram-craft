import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import styles from './EntityOverviewTab.module.css';

type EntityProjectAssoc = { project: Project; entity_type: ProjectEntity['entity_type'] };

/** Renders the projects an entity belongs to. */
export const ProjectsBlock = ({ entityProjects }: { entityProjects: EntityProjectAssoc[] }) =>
  entityProjects.length === 0 ? (
    <div className={styles.metaPropRow}>
      <span className={`${styles.metaPropValue} ${styles.metaPropMuted}`}>Not in any project</span>
    </div>
  ) : (
    entityProjects.map(({ project, entity_type }) => (
      <div key={project.id} className={styles.metaPropRow}>
        <span className={styles.metaPropLabel}>{project.name}</span>
        <span className={styles.metaPropValue}>
          {entity_type ? entity_type.name : <span className={styles.metaPropMuted}>—</span>}
        </span>
      </div>
    ))
  );
