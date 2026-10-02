import type { Assessment } from '@arch-register/api-types/assessmentContract';

export type AssessmentWidgetMode = 'active' | 'upcoming' | 'overdue' | 'all';

export type AssessmentFilterOptions = {
  mode: AssessmentWidgetMode;
  assessmentTypeId?: string;
  /** Schema ids; when set, keeps assessments whose `scope` includes any of them. */
  scopeSchemaIds?: readonly string[];
  /** Keeps open assessments due within this many days of `now`; overdue ones are included. */
  dueWithinDays?: number;
  /** Keeps only assessments that have a due date. */
  requireDueDate?: boolean;
};

const DAY_MS = 86_400_000;

const daysUntil = (iso: string, now: Date): number => {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.round((due.getTime() - todayMidnight.getTime()) / DAY_MS);
};

export const filterAssessments = <T extends Assessment>(
  assessments: readonly T[],
  options: AssessmentFilterOptions,
  now: Date = new Date()
): T[] => {
  const nowIso = now.toISOString();
  return assessments.filter(assessment => {
    if (options.mode !== 'all') {
      if (assessment.status !== 'open') return false;
      if (options.mode === 'upcoming') {
        if (assessment.due_at === null || assessment.due_at < nowIso) return false;
      } else if (options.mode === 'overdue') {
        if (assessment.due_at === null || assessment.due_at >= nowIso) return false;
      }
    }
    if (
      options.assessmentTypeId !== undefined &&
      assessment.assessment_type_id !== options.assessmentTypeId
    ) {
      return false;
    }
    if (
      options.scopeSchemaIds !== undefined &&
      !options.scopeSchemaIds.some(id => assessment.scope.includes(id))
    ) {
      return false;
    }
    if (options.requireDueDate && assessment.due_at === null) return false;
    if (options.dueWithinDays !== undefined) {
      if (assessment.status !== 'open' || assessment.due_at === null) return false;
      if (daysUntil(assessment.due_at, now) > options.dueWithinDays) return false;
    }
    return true;
  });
};
