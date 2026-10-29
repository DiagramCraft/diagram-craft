import type { Assessment } from '@arch-register/api-types/assessmentContract';

export const ASSESSMENT_STATUS_LABEL: Record<Assessment['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived'
};

/** Filter options of the project assessments list; `default` shows open and closed assessments. */
export type AssessmentListFilter = 'default' | 'draft' | 'archived' | 'all';

export const matchesAssessmentListFilter = (
  assessment: Pick<Assessment, 'status'>,
  filter: AssessmentListFilter
) => {
  if (filter === 'all') return true;
  if (filter === 'default') return assessment.status === 'open' || assessment.status === 'closed';
  return assessment.status === filter;
};
