import {
  ENTITY_ASSESSMENT_STATUS_LABEL,
  type EntityAssessmentStatus,
  type EntityAssessmentSummary
} from '../../entities/entityDrawer/entityAssessments';

export const ASSESSMENT_STATUSES = [
  'overdue',
  'in_progress',
  'not_started',
  'complete'
] as const satisfies readonly EntityAssessmentStatus[];

export const ASSESSMENT_STATUS_LABEL = ENTITY_ASSESSMENT_STATUS_LABEL;

/** Status-pill/dot and stat-value colours. */
export const ASSESSMENT_STATUS_TONE: Record<EntityAssessmentStatus, string> = {
  overdue: 'var(--cmp-fg-danger, #ef4444)',
  in_progress: 'var(--cmp-fg-warning, #eab308)',
  not_started: 'var(--cmp-fg-dim, #9ca3af)',
  complete: 'var(--cmp-fg-success, #22c55e)'
};

/** Statuses whose stat value is only tinted while the count is non-zero. */
export const TINTED_ASSESSMENT_STATUSES: readonly EntityAssessmentStatus[] = [
  'overdue',
  'in_progress'
];

export const isAssessmentStatus = (value: unknown): value is EntityAssessmentStatus =>
  ASSESSMENT_STATUSES.includes(value as EntityAssessmentStatus);

export const countByStatus = (
  summaries: readonly Pick<EntityAssessmentSummary, 'status'>[]
): Record<EntityAssessmentStatus, number> => {
  const counts: Record<EntityAssessmentStatus, number> = {
    overdue: 0,
    in_progress: 0,
    not_started: 0,
    complete: 0
  };
  summaries.forEach(summary => {
    counts[summary.status] += 1;
  });
  return counts;
};

/** Placeholders: `{count}` (this status), `{total}` (all assessments), `{notStarted}`. */
export const renderAssessmentSubtext = (
  template: string,
  counts: Record<EntityAssessmentStatus, number>,
  status: EntityAssessmentStatus
): string => {
  const total = ASSESSMENT_STATUSES.reduce((sum, key) => sum + counts[key], 0);
  return template
    .replaceAll('{count}', String(counts[status]))
    .replaceAll('{total}', String(total))
    .replaceAll('{notStarted}', String(counts.not_started));
};

/** Filters by optional status and free-text (name, kind, project name); sorts by due ascending. */
export const filterAssessmentSummaries = (
  summaries: readonly EntityAssessmentSummary[],
  options: {
    status?: EntityAssessmentStatus;
    query: string;
    projectNameOf: (projectId: string) => string | undefined;
  }
): EntityAssessmentSummary[] => {
  const needle = options.query.trim().toLowerCase();
  return summaries
    .filter(summary => !options.status || summary.status === options.status)
    .filter(summary => {
      if (!needle) return true;
      const projectName = options.projectNameOf(summary.assessment.project_id) ?? '';
      return `${summary.assessment.name} ${summary.kind} ${projectName}`
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
};
