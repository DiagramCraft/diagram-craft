import { describe, expect, it } from 'vitest';
import type { EntityAssessmentSummary } from '../../entities/entityDrawer/entityAssessments';
import {
  countByStatus,
  filterAssessmentSummaries,
  renderAssessmentSubtext
} from './assessmentSummaryLogic';

const summary = (
  id: string,
  status: EntityAssessmentSummary['status'],
  due: string | null,
  name = id
): EntityAssessmentSummary =>
  ({
    assessment: { id, name, project_id: `p-${id}` },
    kind: 'Impact',
    status,
    due
  }) as never;

const summaries = [
  summary('a', 'overdue', '2026-01-02'),
  summary('b', 'complete', '2026-01-01'),
  summary('c', 'not_started', null),
  summary('d', 'not_started', '2026-02-01', 'Transfer review')
];

describe('assessmentSummaryLogic', () => {
  it('counts by status', () => {
    expect(countByStatus(summaries)).toEqual({
      overdue: 1,
      in_progress: 0,
      not_started: 2,
      complete: 1
    });
  });

  it('renders subtext placeholders', () => {
    const counts = countByStatus(summaries);
    expect(renderAssessmentSubtext('{notStarted} not started', counts, 'in_progress')).toBe(
      '2 not started'
    );
    expect(renderAssessmentSubtext('{count} of {total}', counts, 'complete')).toBe('1 of 4');
  });

  it('filters by status and text and sorts by due ascending', () => {
    const projectNameOf = (id: string) => (id === 'p-c' ? 'Privacy' : undefined);
    const all = filterAssessmentSummaries(summaries, { query: '', projectNameOf });
    expect(all.map(s => s.assessment.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(
      filterAssessmentSummaries(summaries, { status: 'not_started', query: '', projectNameOf }).map(
        s => s.assessment.id
      )
    ).toEqual(['c', 'd']);
    expect(
      filterAssessmentSummaries(summaries, { query: 'privacy', projectNameOf }).map(
        s => s.assessment.id
      )
    ).toEqual(['c']);
  });
});
