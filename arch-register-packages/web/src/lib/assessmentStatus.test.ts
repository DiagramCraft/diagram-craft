import { describe, expect, it } from 'vitest';
import { matchesAssessmentListFilter } from './assessmentStatus';

describe('matchesAssessmentListFilter', () => {
  it('shows open and closed assessments by default', () => {
    expect(matchesAssessmentListFilter({ status: 'open' }, 'default')).toBe(true);
    expect(matchesAssessmentListFilter({ status: 'closed' }, 'default')).toBe(true);
    expect(matchesAssessmentListFilter({ status: 'draft' }, 'default')).toBe(false);
    expect(matchesAssessmentListFilter({ status: 'archived' }, 'default')).toBe(false);
  });

  it('matches a single status for draft and archived', () => {
    expect(matchesAssessmentListFilter({ status: 'draft' }, 'draft')).toBe(true);
    expect(matchesAssessmentListFilter({ status: 'open' }, 'draft')).toBe(false);
    expect(matchesAssessmentListFilter({ status: 'archived' }, 'archived')).toBe(true);
  });

  it('matches everything for all', () => {
    for (const status of ['draft', 'open', 'closed', 'archived'] as const) {
      expect(matchesAssessmentListFilter({ status }, 'all')).toBe(true);
    }
  });
});
