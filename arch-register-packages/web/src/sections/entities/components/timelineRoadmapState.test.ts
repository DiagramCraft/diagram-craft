import { describe, expect, it } from 'vitest';
import type { TimelineViewData } from '@arch-register/api-types/entityContract';
import { buildTimelineHorizonBands, collectTimelineEventDates } from './timelineRoadmapState';

describe('timeline roadmap state', () => {
  it('builds continuous Historical, Now, Next, and Later quarter bands', () => {
    const bands = buildTimelineHorizonBands({
      today: new Date('2026-08-11T00:00:00'),
      rangeStart: new Date('2025-01-01T00:00:00'),
      rangeEnd: new Date('2027-12-31T00:00:00'),
      totalWidth: 1200
    });

    expect(bands.map(band => band.id)).toEqual(['historical', 'now', 'next', 'later']);
    expect(bands.map(band => band.label)).toEqual(['Historical', 'Now', 'Next', 'Later']);
    expect(bands[1]?.start).toEqual(new Date('2026-07-01T00:00:00'));
    expect(bands[2]?.start).toEqual(new Date('2026-10-01T00:00:00'));
    expect(bands[3]?.start).toEqual(new Date('2027-01-01T00:00:00'));
    expect(bands[0]?.left).toBe(0);
    expect(bands.at(-1)?.left! + bands.at(-1)?.width!).toBeCloseTo(1200);
  });

  it('collects entity history, planned change, milestone, and project dates', () => {
    const timelineData = {
      entity: {
        versions: [{ id: 'version', created_at: '2025-02-01T00:00:00Z' }],
        projectChanges: [
          {
            changeCase: {
              target_date: '2026-10-01',
              created_at: '2025-03-01T00:00:00Z'
            }
          }
        ]
      }
    } as unknown as Record<string, TimelineViewData>;

    const dates = collectTimelineEventDates(
      timelineData,
      [{ target_date: '2027-01-15' }] as never,
      [{ start_date: '2025-04-01', target_date: '2027-04-01' }] as never
    );

    expect(
      dates.map(date =>
        [date.getFullYear(), date.getMonth() + 1, date.getDate()]
          .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
          .join('-')
      )
    ).toEqual(['2025-02-01', '2026-10-01', '2027-01-15', '2025-04-01', '2027-04-01']);
  });
});
