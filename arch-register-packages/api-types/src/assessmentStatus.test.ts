import { describe, expect, it } from 'vitest';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';

const requiredField: AssessmentField = {
  id: 'f1',
  label: 'Rating',
  requirementLevel: 'required',
  type: 'rating'
};

describe('computeAssessmentStatus (fields mode)', () => {
  it('is complete when there are no fields at all', () => {
    expect(computeAssessmentStatus([], undefined)).toBe('complete');
  });

  it('is not_started when no required fields are answered', () => {
    expect(computeAssessmentStatus([requiredField], {})).toBe('not_started');
  });

  it('is complete when all required fields are answered', () => {
    expect(computeAssessmentStatus([requiredField], { f1: 4 })).toBe('complete');
  });
});

describe('computeAssessmentStatus (confirm mode)', () => {
  it('is not_started when no response has been recorded', () => {
    expect(computeAssessmentStatus([], undefined, 'confirm')).toBe('not_started');
  });

  it('is complete once a response row exists, even with empty values', () => {
    expect(computeAssessmentStatus([], {}, 'confirm')).toBe('complete');
  });
});
