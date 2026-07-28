import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbCircleCheck } from 'react-icons/tb';
import { useMilestones } from '../../../hooks/useMilestones';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import styles from './ProjectSummaryWidget.module.css';

const MAX_UPCOMING = 3;

export const UpcomingMilestonesWidget = () => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const { data: milestones = [], isLoading } = useMilestones(workspaceSlug, projectId);

  const { lastCompleted, upcoming, totalRemaining } = useMemo(() => {
    const completed = milestones
      .filter(m => m.status === 'complete')
      .sort((a, b) => b.target_date.localeCompare(a.target_date));
    const rest = milestones
      .filter(m => m.status !== 'complete' && m.status !== 'cancelled')
      .sort((a, b) => a.target_date.localeCompare(b.target_date));
    return {
      lastCompleted: completed[0],
      upcoming: rest.slice(0, MAX_UPCOMING),
      totalRemaining: rest.length
    };
  }, [milestones]);

  if (!projectId) {
    return <div className={`${styles.emptyInline} dim`}>No project in context.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading milestones...</div>;
  }

  const items = [...(lastCompleted ? [lastCompleted] : []), ...upcoming];

  if (items.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No milestones.</div>;
  }

  const goToMilestones = () =>
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
        section: 'milestones' as const
      })
    );

  return (
    <div className={styles.list}>
      {items.map(milestone => (
        <button
          key={milestone.id}
          type="button"
          className={styles.row}
          onClick={goToMilestones}
        >
          {milestone.status === 'complete' && <TbCircleCheck size={12} className="dim" />}
          <span className={styles.rowLabel}>{milestone.name}</span>
          <span className={styles.rowMeta}>{formatDate(milestone.target_date)}</span>
        </button>
      ))}
      {totalRemaining > MAX_UPCOMING && (
        <button type="button" className={styles.footer} onClick={goToMilestones}>
          View all {totalRemaining} upcoming milestones
        </button>
      )}
    </div>
  );
};
