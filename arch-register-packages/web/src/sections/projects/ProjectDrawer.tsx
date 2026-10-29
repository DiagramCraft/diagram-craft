import { Button } from '@diagram-craft/app-components/Button';
import { useNavigate } from '@tanstack/react-router';
import { Chip } from '../../components/Chip';
import { Drawer } from '../../components/Drawer';
import { useDateTimeFormatPreference } from '../../hooks/useDateTimeFormatPreference';
import { useProject } from '../../hooks/useProjects';
import { PROJECT_STATUS_OPTIONS } from '../../lib/projectStatus';
import { asProjectPublicId, projectDetailRoute } from '../../routes/publicObjectRoutes';
import { formatDate } from '../../utils/dateFormat';
import styles from '../governance/GovernanceCaseDrawer.module.css';

/**
 * Read-only drawer summarising a project, opened from an entity's Projects block. Hosted in the
 * workspace drawer stack (see `useEntityDrawer`); `projectId` is the project's public id.
 */
export const ProjectDrawer = ({
  workspaceSlug,
  projectId,
  onClose,
  active,
  stacked,
  stackOffset
}: {
  workspaceSlug: string;
  projectId: string;
  onClose: () => void;
  active?: boolean;
  stacked?: boolean;
  stackOffset?: number;
}) => {
  const navigate = useNavigate();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const { data: project, isLoading, isError } = useProject(workspaceSlug, projectId);
  const stackProps = { active, stacked, stackOffset };

  if (isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…" {...stackProps}>
        <div className={styles.empty}>Loading project…</div>
      </Drawer>
    );
  }
  if (isError || !project) {
    return (
      <Drawer onClose={onClose} title="Unavailable" {...stackProps}>
        <div className={styles.empty}>This project is unavailable.</div>
      </Drawer>
    );
  }

  const statusLabel =
    PROJECT_STATUS_OPTIONS.find(option => option.value === project.status)?.label ?? project.status;
  const date = (value: string | null) => formatDate(value, '—', dateTimeFormatPreference);

  return (
    <Drawer
      onClose={onClose}
      {...stackProps}
      eyebrow={<span className="dim mono">Project · {project.public_id}</span>}
      title={project.name}
      badges={<Chip tone="ghost">{statusLabel}</Chip>}
      footer={
        <Button
          variant="primary"
          onClick={() => {
            navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(project.public_id)));
            onClose();
          }}
        >
          Open project
        </Button>
      }
    >
      {project.description && (
        <>
          <div className={styles.sectionLabel}>Description</div>
          <div>{project.description}</div>
        </>
      )}
      <div className={styles.sectionLabel}>Details</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{project.owner?.name ?? '—'}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Start date</span>
        <span>{date(project.start_date)}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Target date</span>
        <span>{date(project.target_date)}</span>
      </div>
    </Drawer>
  );
};
