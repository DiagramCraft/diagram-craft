import { describe, expect, it } from 'vitest';
import {
  dueJobOccurrences,
  nextJobOccurrence,
  validateJobScheduleRecurrence
} from './jobRecurrence';

describe('job recurrence', () => {
  it('calculates minute occurrences from an anchored start', () => {
    const recurrence = {
      type: 'minutes' as const,
      intervalMinutes: 5,
      startsAt: new Date('2026-01-01T00:00:00.000Z')
    };

    expect(nextJobOccurrence(recurrence, new Date('2026-01-01T00:12:00.000Z'))).toEqual(
      new Date('2026-01-01T00:15:00.000Z')
    );
  });

  it('calculates hourly occurrences from an anchored start', () => {
    const recurrence = {
      type: 'hours' as const,
      intervalHours: 3,
      startsAt: new Date('2026-01-01T01:00:00.000Z')
    };

    expect(nextJobOccurrence(recurrence, new Date('2026-01-01T07:00:00.000Z'))).toEqual(
      new Date('2026-01-01T07:00:00.000Z')
    );
  });

  it('calculates daily and weekly UTC occurrences', () => {
    expect(
      nextJobOccurrence({ type: 'daily', timeUtc: '09:30' }, new Date('2026-01-01T10:00:00.000Z'))
    ).toEqual(new Date('2026-01-02T09:30:00.000Z'));
    expect(
      nextJobOccurrence(
        { type: 'weekly', weekdayUtc: 1, timeUtc: '09:30' },
        new Date('2026-01-04T10:00:00.000Z')
      )
    ).toEqual(new Date('2026-01-05T09:30:00.000Z'));
  });

  it('reports all due occurrences for coalescing', () => {
    const recurrence = {
      type: 'hours' as const,
      intervalHours: 1,
      startsAt: new Date('2026-01-01T00:00:00.000Z')
    };
    expect(
      dueJobOccurrences(
        recurrence,
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-01T02:00:00.000Z')
      )
    ).toEqual({
      first: new Date('2026-01-01T00:00:00.000Z'),
      last: new Date('2026-01-01T02:00:00.000Z'),
      count: 3,
      next: new Date('2026-01-01T03:00:00.000Z')
    });
  });

  it('rejects invalid recurrence definitions', () => {
    expect(() =>
      validateJobScheduleRecurrence({ type: 'minutes', intervalMinutes: 0, startsAt: new Date() })
    ).toThrow();
    expect(() =>
      validateJobScheduleRecurrence({ type: 'hours', intervalHours: 0, startsAt: new Date() })
    ).toThrow();
    expect(() => validateJobScheduleRecurrence({ type: 'daily', timeUtc: '25:00' })).toThrow();
    expect(() =>
      validateJobScheduleRecurrence({ type: 'weekly', weekdayUtc: 7, timeUtc: '10:00' })
    ).toThrow();
  });
});
