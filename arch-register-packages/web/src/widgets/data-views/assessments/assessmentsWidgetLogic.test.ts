import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { filterAssessments } from './assessmentsWidgetLogic';

const now = new Date('2026-10-02T10:00:00');

const assessment = (
  id: string,
  overrides: Partial<Pick<Assessment, 'status' | 'due_at' | 'scope' | 'assessment_type_id'>>
) =>
  ({
    id,
    status: 'open',
    due_at: null,
    scope: [],
    assessment_type_id: 'type-a',
    ...overrides
  }) as unknown as Assessment;

const all = [
  assessment('late', { due_at: '2026-09-20T00:00:00Z', scope: ['risk'] }),
  assessment('soon', { due_at: '2026-10-12T00:00:00Z', scope: ['control'] }),
  assessment('far', { due_at: '2026-12-01T00:00:00Z', scope: ['risk'] }),
  assessment('nodate', { scope: ['risk'] }),
  assessment('closed', { status: 'closed', due_at: '2026-10-05T00:00:00Z', scope: ['risk'] }),
  assessment('other', { due_at: '2026-10-05T00:00:00Z', scope: ['vendor'] })
];

const ids = (list: Assessment[]) => list.map(a => a.id);

describe('filterAssessments', () => {
  it('active keeps open assessments including undated ones', () => {
    expect(ids(filterAssessments(all, { mode: 'active' }, now))).toEqual([
      'late',
      'soon',
      'far',
      'nodate',
      'other'
    ]);
  });

  it('filters by scope schema ids', () => {
    expect(
      ids(filterAssessments(all, { mode: 'active', scopeSchemaIds: ['risk', 'control'] }, now))
    ).toEqual(['late', 'soon', 'far', 'nodate']);
  });

  it('requireDueDate drops undated assessments', () => {
    expect(
      ids(
        filterAssessments(
          all,
          { mode: 'active', scopeSchemaIds: ['risk', 'control'], requireDueDate: true },
          now
        )
      )
    ).toEqual(['late', 'soon', 'far']);
  });

  it('dueWithinDays includes overdue and excludes later or undated or closed', () => {
    expect(
      ids(
        filterAssessments(
          all,
          { mode: 'active', scopeSchemaIds: ['risk', 'control'], dueWithinDays: 30 },
          now
        )
      )
    ).toEqual(['late', 'soon']);
  });

  it('overdue and upcoming split on now', () => {
    expect(ids(filterAssessments(all, { mode: 'overdue' }, now))).toEqual(['late']);
    expect(ids(filterAssessments(all, { mode: 'upcoming' }, now))).toEqual([
      'soon',
      'far',
      'other'
    ]);
  });
});
