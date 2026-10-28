import { Button } from '@diagram-craft/app-components/Button';
import { useNavigate } from '@tanstack/react-router';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { StatusChip } from '../../../components/StatusChip';
import { TypeBadge } from '../../../components/TypeBadge';
import { useChangeCase } from '../../../hooks/useChangeCases';
import { useEntity } from '../../../hooks/useEntities';
import { useMilestones } from '../../../hooks/useMilestones';
import { useProjects } from '../../../hooks/useProjects';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaPresentation } from '../../../lib/schemaPresentation';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { diffSnapshotState } from '../components/entityTimelineHelpers';
import { SnapshotChangeList } from '../components/SnapshotChangeList';
import { getSnapshotDateLabel, toMilestonesById } from '../components/snapshotDisplay';
import { useEntityDrawer } from './useEntityDrawer';
import styles from './PlannedChangeDrawer.module.css';
import drawerStyles from '../../governance/GovernanceCaseDrawer.module.css';

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned change',
  in_approval: 'In approval',
  applied: 'Applied',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  cancelled: 'Cancelled',
  superseded: 'Superseded'
};

/**
 * Drawer for one entity's planned (or applied) change within a project change case, opened from the
 * Planned changes tab and the Timeline view. Hosted in the workspace drawer stack (see
 * `useEntityDrawer`). Its footer links to the project's planned-changes tab. Shows the project, target date or milestone, note, the entity's current
 * status and the field-level diff between the state the change was planned against and the
 * proposed state.
 */
export const PlannedChangeDrawer = ({
  workspaceSlug,
  projectId,
  caseId,
  memberId,
  onClose,
  active,
  stacked,
  stackOffset
}: {
  workspaceSlug: string;
  projectId: string;
  caseId: string;
  memberId: string;
  onClose: () => void;
  active?: boolean;
  stacked?: boolean;
  stackOffset?: number;
}) => {
  const navigate = useNavigate();
  const { schemas, lifecycleStates, teams } = useWorkspaceContext();
  const { openProjectDrawer } = useEntityDrawer();
  const stackProps = { active, stacked, stackOffset };
  const changeCase = useChangeCase(workspaceSlug, projectId, caseId);
  const member = changeCase.data?.members.find(m => m.id === memberId);
  const entity = useEntity(workspaceSlug, member?.entity_id ?? '', member != null);
  const { data: projects = [] } = useProjects(workspaceSlug);
  const { data: milestones = [] } = useMilestones(workspaceSlug);

  if (changeCase.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…" {...stackProps}>
        <div className={drawerStyles.empty}>Loading planned change…</div>
      </Drawer>
    );
  }
  if (changeCase.isError || !changeCase.data || !member) {
    return (
      <Drawer onClose={onClose} title="Unavailable" {...stackProps}>
        <div className={drawerStyles.empty}>This planned change is unavailable.</div>
      </Drawer>
    );
  }

  const kase = changeCase.data;
  const entityRecord = entity.data;
  const { schema, color: schemaColor } = resolveSchemaPresentation(
    schemas,
    entityRecord?._schema.id
  );
  const project = projects.find(p => p.id === kase.project_id);
  const dateLabel = getSnapshotDateLabel(kase, toMilestonesById(milestones));
  const changes = diffSnapshotState(
    member.base_state,
    member.proposed_state,
    schema,
    lifecycleStates,
    teams
  );

  return (
    <Drawer
      onClose={onClose}
      {...stackProps}
      eyebrow={
        schema && (
          <>
            <TypeBadge color={schemaColor} name={schema.name} icon={schema.icon} size={18} />
            <span>{schema.name}</span>
          </>
        )
      }
      title={entityRecord?._name ?? entityRecord?._slug ?? '…'}
      badges={<Chip tone="ghost">{STATUS_LABEL[kase.status] ?? kase.status}</Chip>}
      footer={
        project && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              navigate(
                projectDetailRoute(workspaceSlug, asProjectPublicId(project.public_id), {
                  tab: 'projects',
                  section: 'plan',
                  planTab: 'planned-changes'
                })
              );
              onClose();
            }}
          >
            Open in project plan
          </Button>
        )
      }
    >
      <div className={styles.body}>
        {project && (
          <div className={styles.field}>
            <div className={styles.label}>Project</div>
            <div className={styles.project}>
              <span
                className={styles.projectDot}
                style={{ background: project.color ?? 'var(--accent-fg)' }}
              />
              <button
                type="button"
                className={styles.projectLink}
                onClick={() => openProjectDrawer(project.public_id)}
              >
                {project.name}
              </button>
            </div>
          </div>
        )}

        <div className={styles.field}>
          <div className={styles.label}>{kase.milestone_id ? 'Milestone' : 'Target date'}</div>
          <div className={styles.value}>{dateLabel ?? '—'}</div>
        </div>

        {kase.commit_message && (
          <div className={styles.field}>
            <div className={styles.label}>Note</div>
            <p className={styles.note}>{kase.commit_message}</p>
          </div>
        )}

        {entityRecord?._lifecycle && (
          <div className={styles.field}>
            <div className={styles.label}>Entity status</div>
            <StatusChip value={entityRecord._lifecycle.id} lifecycleStates={lifecycleStates} />
          </div>
        )}

        <div className={`${styles.field} ${styles.changes}`}>
          <div className={styles.label}>Changes</div>
          <SnapshotChangeList changes={changes} emptyText="No field changes" />
        </div>
      </div>
    </Drawer>
  );
};
