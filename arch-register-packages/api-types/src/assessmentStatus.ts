import type { AssessmentField } from '@arch-register/api-types/assessmentContract';

export type AssessmentEntityStatus = 'not_started' | 'in_progress' | 'complete';

const isAnswered = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

export const computeAssessmentStatus = (
  fields: AssessmentField[],
  values: Record<string, unknown> | undefined
): AssessmentEntityStatus => {
  const requiredFields = fields.filter(f => f.requirementLevel === 'required');
  if (requiredFields.length === 0) return 'complete';

  const answered = requiredFields.filter(f => isAnswered(values?.[f.id])).length;
  if (answered === 0) return 'not_started';
  return answered >= requiredFields.length ? 'complete' : 'in_progress';
};
