import { describe, expect, it } from 'vitest';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { ChangeCaseMemberEntry } from '../../entities/components/snapshotDisplay';
import { buildTimelineMarkers } from './changeCaseTimelineMarkers';

const entry = (
  status: 'planned' | 'applied',
  target_date: string | null,
  milestone_id: string | null = null
) =>
  ({
    changeCase: { status, target_date, milestone_id },
    member: {}
  }) as unknown as ChangeCaseMemberEntry;

describe('buildTimelineMarkers', () => {
  const milestones = new Map([['m1', { id: 'm1', target_date: '2026-09-01' } as Milestone]]);

  it('counts members per effective date and status', () => {
    const markers = buildTimelineMarkers(
      [
        entry('planned', '2026-08-01'),
        entry('planned', '2026-08-01'),
        entry('applied', '2026-08-01'),
        entry('planned', null, 'm1')
      ],
      milestones
    );
    expect(markers).toEqual([
      { date: '2026-08-01', type: 'future_update', count: 2 },
      { date: '2026-08-01', type: 'applied', count: 1 },
      { date: '2026-09-01', type: 'future_update', count: 1 }
    ]);
  });

  it('skips changes with no resolvable date', () => {
    expect(buildTimelineMarkers([entry('planned', null)], milestones)).toEqual([]);
  });
});
