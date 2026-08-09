import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAssessments, useProjectAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import styles from './WidgetRowList.module.css';

const MAX_ITEMS = 4;

export type AssessmentWidgetMode = 'active' | 'upcoming' | 'overdue' | 'all';

export type AssessmentsWidgetConfig = {
  mode: AssessmentWidgetMode;
  assessmentTypeId?: string;
  label?: string;
};

type Props = {
  config: AssessmentsWidgetConfig;
};

const emptyStateLabel: Record<AssessmentWidgetMode, string> = {
  active: 'active assessments',
  upcoming: 'upcoming assessments',
  overdue: 'overdue assessments',
  all: 'assessments'
};

const sortByDueDate = <T extends { due_at: string | null }>(assessments: T[]): T[] =>
  [...assessments].sort((a, b) => {
    if (a.due_at === null && b.due_at === null) return 0;
    if (a.due_at === null) return 1;
    if (b.due_at === null) return -1;
    return a.due_at.localeCompare(b.due_at);
  });

export const AssessmentsWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId, dashboardSurface = 'workspace' } = useMdxContext();

  const workspaceQuery = useAssessments(workspaceSlug, dashboardSurface === 'workspace');
  const projectQuery = useProjectAssessments(workspaceSlug, projectId ?? '');
  const { data: assessments = [], isLoading } =
    dashboardSurface === 'project' ? projectQuery : workspaceQuery;

  const filteredAssessments = useMemo(() => {
    const now = new Date().toISOString();

    return sortByDueDate(
      assessments
        .filter(assessment => {
          if (config.mode === 'all') return true;
          if (assessment.status !== 'open') return false;
          if (config.mode === 'active') return true;
          if (config.mode === 'upcoming') {
            return assessment.due_at !== null && assessment.due_at >= now;
          }
          return assessment.due_at !== null && assessment.due_at < now;
        })
        .filter(
          assessment =>
            config.assessmentTypeId === undefined ||
            assessment.assessment_type_id === config.assessmentTypeId
        )
    );
  }, [assessments, config.assessmentTypeId, config.mode]);

  if (dashboardSurface === 'project' && projectId === undefined) {
    return <div className={`${styles.emptyInline} dim`}>No project in context.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading assessments...</div>;
  }

  if (filteredAssessments.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No {emptyStateLabel[config.mode]}.</div>;
  }

  const shown = filteredAssessments.slice(0, MAX_ITEMS);
  const goToAssessment = (assessmentId: string, assessmentProjectId: string) =>
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(assessmentProjectId), {
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
          <span className={styles.rowMeta}>
            {assessment.due_at ? formatDate(assessment.due_at) : '—'}
          </span>
        </button>
      ))}
      {filteredAssessments.length > MAX_ITEMS && (
        <div className={`${styles.footer} dim`}>
          +{filteredAssessments.length - MAX_ITEMS} more assessments
        </div>
      )}
    </div>
  );
};
