import { describe, expect, it } from 'vitest';
import { buildPositionedRanges } from './dateRangeTimelineLogic';

const options = {
  startFieldId: 'start',
  endFieldId: 'end',
  markerOffsetFieldId: 'notice',
  markerWhenFieldId: 'auto'
};

describe('buildPositionedRanges', () => {
  it('excludes records missing a start or end date', () => {
    const { positioned, excludedCount } = buildPositionedRanges(
      [
        { _uid: 'a', start: '2026-01-01', end: '2026-12-31' },
        { _uid: 'b', start: '2026-01-01' },
        { _uid: 'c', end: '2026-01-01' }
      ],
      options
    );
    expect(positioned.map(p => p.record._uid)).toEqual(['a']);
    expect(excludedCount).toBe(2);
  });

  it('adds a marker only when the condition field is true', () => {
    const { positioned } = buildPositionedRanges(
      [
        { _uid: 'a', start: '2026-01-01', end: '2026-12-31', notice: 30, auto: true },
        { _uid: 'b', start: '2026-01-01', end: '2026-12-31', notice: 30, auto: false },
        { _uid: 'c', start: '2026-01-01', end: '2026-12-31', auto: true }
      ],
      options
    );
    expect(positioned[0]!.markerDate?.getDate()).toBe(1);
    expect(positioned[0]!.markerDate?.getMonth()).toBe(11);
    expect(positioned[1]!.markerDate).toBeNull();
    expect(positioned[2]!.markerDate).toBeNull();
  });
});
