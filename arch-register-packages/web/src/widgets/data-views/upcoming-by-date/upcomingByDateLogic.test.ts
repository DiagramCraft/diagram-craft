import { describe, expect, it } from 'vitest';
import { buildUpcomingRows, countdownTone, formatCountdown } from './upcomingByDateLogic';

const today = new Date(2026, 9, 7);
const records = [
  { n: 'b', d: '2026-11-01' },
  { n: 'a', d: '2026-10-10' },
  { n: 'late', d: '2026-09-01' },
  { n: 'far', d: '2027-10-01' },
  { n: 'none' }
];

describe('buildUpcomingRows', () => {
  it('sorts soonest first, honouring window and limit', () => {
    const rows = buildUpcomingRows(records, { dateFieldId: 'd', windowDays: 90, limit: 5, today });
    expect(rows.map(r => r.record.n)).toEqual(['a', 'b']);
    expect(rows[0]!.days).toBe(3);
  });
  it('includes overdue only when asked', () => {
    const rows = buildUpcomingRows(records, {
      dateFieldId: 'd',
      includeOverdue: true,
      limit: 1,
      today
    });
    expect(rows[0]!.record.n).toBe('late');
  });
});

describe('countdown', () => {
  it('formats and tones', () => {
    expect(formatCountdown(-3)).toBe('3d ago');
    expect(formatCountdown(0)).toBe('today');
    expect(countdownTone(10)).toBe('crit');
    expect(countdownTone(60)).toBe('warn');
    expect(countdownTone(200)).toBe('normal');
  });
});
