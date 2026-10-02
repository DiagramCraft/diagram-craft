import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAssessments, useProjectAssessments } from '../../../hooks/useAssessments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../markdown/MdxContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { filterAssessments, type AssessmentWidgetMode } from './assessmentsWidgetLogic';
import styles from './WidgetRowList.module.css';

const MAX_ITEMS = 4;

export type { AssessmentWidgetMode } from './assessmentsWidgetLogic';

export type AssessmentsWidgetConfig = {
  mode: AssessmentWidgetMode;
  assessmentTypeId?: string;
  /** Entity schema names; keeps assessments scoped to any of them. */
  schemaNames?: string[];
  /** Shows a day-count due label ("18d" / "6d late") and the owning project, and hides undated
   *  assessments. */
  relativeDue?: boolean;
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

/** Resolves schema names to ids; `undefined` (no scope filter) when none are configured. */
export const resolveScopeSchemaIds = (
  schemaNames: readonly string[] | undefined,
  schemas: ReadonlyArray<{ id: string; name: string }>
): string[] | undefined =>
  schemaNames === undefined || schemaNames.length === 0
    ? undefined
    : schemas.filter(schema => schemaNames.includes(schema.name)).map(schema => schema.id);

const sortByDueDate = <T extends { due_at: string | null }>(assessments: T[]): T[] =>
  [...assessments].sort((a, b) => {
    if (a.due_at === null && b.due_at === null) return 0;
    if (a.due_at === null) return 1;
    if (b.due_at === null) return -1;
    return a.due_at.localeCompare(b.due_at);
  });

export const AssessmentsWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, projects } = useWorkspaceContext();
  const { projectId, dashboardSurface = 'workspace' } = useMdxContext();

  const workspaceQuery = useAssessments(workspaceSlug, dashboardSurface === 'workspace');
  const projectQuery = useProjectAssessments(workspaceSlug, projectId ?? '');
  const { data: assessments = [], isLoading } =
    dashboardSurface === 'project' ? projectQuery : workspaceQuery;

  const filteredAssessments = useMemo(
    () =>
      sortByDueDate(
        filterAssessments(assessments, {
          mode: config.mode,
          assessmentTypeId: config.assessmentTypeId,
          scopeSchemaIds: resolveScopeSchemaIds(config.schemaNames, schemas),
          requireDueDate: config.relativeDue
        })
      ),
    [
      assessments,
      config.assessmentTypeId,
      config.mode,
      config.relativeDue,
      config.schemaNames,
      schemas
    ]
  );
  const projectNameById = useMemo(
    () => new Map(projects.map(project => [project.id, project.name])),
    [projects]
  );

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
          {config.relativeDue && (
            <span className={`${styles.rowSub} dim mono`}>
              {projectNameById.get(assessment.project_id) ?? '—'}
            </span>
          )}
          <span
            className={styles.rowMeta}
            style={config.relativeDue ? { color: dueTone(assessment.due_at) } : undefined}
          >
            {config.relativeDue
              ? dueLabel(assessment.due_at)
              : assessment.due_at
                ? formatDate(assessment.due_at)
                : '—'}
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
