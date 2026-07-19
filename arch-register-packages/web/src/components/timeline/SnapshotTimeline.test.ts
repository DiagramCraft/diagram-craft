import { describe, expect, it } from 'vitest';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { buildSnapshotTimelineContext, type SnapshotTimelineContextArgs } from './SnapshotTimeline';

const columnWidths = { month: 72, quarter: 100, year: 136 } as const;
const today = new Date('2026-06-14T00:00:00Z');

const args = (
  overrides: Partial<SnapshotTimelineContextArgs> = {}
): SnapshotTimelineContextArgs => ({
  dates: [new Date('2026-03-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z')],
  zoom: 'quarter',
  columnWidths,
  today,
  ...overrides
});

const milestone = (overrides: Partial<Milestone>): Milestone =>
  ({
    id: 'm1',
    name: 'Launch',
    project_id: 'p1',
    target_date: '2026-06-01',
    ...overrides
  }) as Milestone;

describe('SnapshotTimeline', () => {
  it('builds shared range and today geometry', () => {
    const context = buildSnapshotTimelineContext(args());

    expect(context.columns.map(column => column.label)).toEqual([
      "Q4 '25",
      "Q1 '26",
      "Q2 '26",
      "Q3 '26",
      "Q4 '26",
      "Q1 '27"
    ]);
    expect(context.columns.find(column => column.isCurrent)?.label).toBe("Q2 '26");
    expect(context.todayPx).toBeGreaterThan(0);
  });

  it('positions dated milestones and ignores invalid target dates', () => {
    const context = buildSnapshotTimelineContext(
      args({
        milestones: new Map([
          ['m1', milestone({})],
          ['m2', milestone({ id: 'm2', target_date: 'not-a-date' })]
        ])
      })
    );

    expect(context.milestoneMarkers).toHaveLength(1);
    expect(context.milestoneMarkers[0]?.milestone.id).toBe('m1');
    expect(context.milestoneMarkers[0]?.px).toBeGreaterThan(0);
  });

  it('uses the timeline fallback range when no snapshot dates exist', () => {
    const context = buildSnapshotTimelineContext(args({ dates: [] }));

    expect(context.columns.length).toBeGreaterThan(0);
    expect(context.todayPx).not.toBeNull();
  });
});
