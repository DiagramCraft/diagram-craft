import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import styles from './WidgetRowList.module.css';

const MAX_ITEMS = 4;

export const ActiveAssessmentsWidget = () => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();

  const { data: assessments = [], isLoading } = useProjectAssessments(
    workspaceSlug,
    projectId ?? ''
  );

  const activeAssessments = useMemo(
    () =>
      assessments
        .filter(a => a.status === 'open')
        .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '')),
    [assessments]
  );

  if (!projectId) {
    return <div className={`${styles.emptyInline} dim`}>No project in context.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading assessments...</div>;
  }

  if (activeAssessments.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No active assessments.</div>;
  }

  const shown = activeAssessments.slice(0, MAX_ITEMS);

  return (
    <div className={styles.list}>
      {shown.map(assessment => (
        <button
          key={assessment.id}
          type="button"
          className={styles.row}
          onClick={() =>
            navigate(
              projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
                section: 'assessments' as const,
                assessmentId: assessment.id
              })
            )
          }
        >
          <span className={styles.rowLabel}>{assessment.name}</span>
          <span className={styles.rowMeta}>
            {assessment.due_at ? formatDate(assessment.due_at) : '—'}
          </span>
        </button>
      ))}
      {activeAssessments.length > MAX_ITEMS && (
        <button
          type="button"
          className={styles.footer}
          onClick={() =>
            navigate(
              projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
                section: 'assessments' as const
              })
            )
          }
        >
          View all {activeAssessments.length} active assessments
        </button>
      )}
    </div>
  );
};
