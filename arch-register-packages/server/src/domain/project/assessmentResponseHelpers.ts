import type { AssessmentDbResult, AssessmentResponseDbResult } from './db/projectDatabase';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';

export const toApiAssessmentResponse = (
  row: AssessmentResponseDbResult,
  assessment: AssessmentDbResult
): AssessmentResponse => ({
  entity_id: row.entity_id,
  values: row.values,
  status: computeAssessmentStatus(assessment.fields, row.values),
  updated_at: row.updated_at.toISOString()
});

export const countCompletedEntities = (
  responses: AssessmentResponseDbResult[],
  assessment: AssessmentDbResult
): number =>
  responses.filter(r => computeAssessmentStatus(assessment.fields, r.values) === 'complete').length;
