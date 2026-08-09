import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAssessments, useProjectAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import styles from './WidgetRowList.module.css';

const MAX_ITEMS = 4;

export type OverdueReviewsWidgetConfig = {
  schema?: string;
  label?: string;
};

type Props = {
  config: OverdueReviewsWidgetConfig;
};

export const OverdueReviewsWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId, dashboardSurface = 'workspace' } = useMdxContext();

  const workspaceQuery = useAssessments(workspaceSlug, dashboardSurface === 'workspace');
  const projectQuery = useProjectAssessments(workspaceSlug, projectId ?? '');
  const { data: assessments = [], isLoading } =
    dashboardSurface === 'project' ? projectQuery : workspaceQuery;

  const overdue = useMemo(() => {
    const now = new Date().toISOString();
    return assessments
      .filter(a => a.status === 'open' && !!a.due_at && a.due_at < now)
      .filter(a => !config.schema || a.scope.includes(config.schema))
      .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
  }, [assessments, config.schema]);

  if (dashboardSurface === 'project' && !projectId) {
    return <div className={`${styles.emptyInline} dim`}>No project in context.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading assessments...</div>;
  }

  if (overdue.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No overdue reviews.</div>;
  }

  const shown = overdue.slice(0, MAX_ITEMS);
  const goToAssessment = (assessmentId: string, projectPublicId: string) =>
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(projectPublicId), {
        section: 'assessments' as const,
        assessmentId
      })
    );

  return (
    <div className={styles.list}>
      {shown.map(assessment => (
        <button
          key={assessment.id}
          type="button"
          className={styles.row}
          onClick={() => goToAssessment(assessment.id, assessment.project_id)}
        >
          <span className={styles.rowLabel}>{assessment.name}</span>
          <span className={styles.rowMeta}>{formatDate(assessment.due_at!)}</span>
        </button>
      ))}
      {overdue.length > MAX_ITEMS && (
        <div className={`${styles.footer} dim`}>+{overdue.length - MAX_ITEMS} more overdue</div>
      )}
    </div>
  );
};
