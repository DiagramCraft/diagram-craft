import { describe, expect, it } from 'vitest';
import { addRetentionDuration, parseIsoDate, toIsoDate } from './retentionDate';

describe('parseIsoDate', () => {
  it('parses a valid YYYY-MM-DD date', () => {
    expect(parseIsoDate('2026-01-15')?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('rejects malformed or non-existent dates', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});

describe('addRetentionDuration', () => {
  it('adds days using fixed-length arithmetic', () => {
    const start = parseIsoDate('2026-01-01')!;
    expect(toIsoDate(addRetentionDuration(start, 10, 'days'))).toBe('2026-01-11');
  });

  it('adds months using calendar arithmetic, clamping overflow days', () => {
    const start = parseIsoDate('2024-01-31')!;
    expect(toIsoDate(addRetentionDuration(start, 1, 'months'))).toBe('2024-02-29');
  });

  it('adds years, clamping Feb 29 on a non-leap target year', () => {
    const start = parseIsoDate('2024-02-29')!;
    expect(toIsoDate(addRetentionDuration(start, 1, 'years'))).toBe('2025-02-28');
  });

  it('adds years spanning multiple leap years correctly', () => {
    const start = parseIsoDate('2020-06-15')!;
    expect(toIsoDate(addRetentionDuration(start, 7, 'years'))).toBe('2027-06-15');
  });

  it('handles multi-year durations expressed via months', () => {
    const start = parseIsoDate('2026-03-01')!;
    expect(toIsoDate(addRetentionDuration(start, 18, 'months'))).toBe('2027-09-01');
  });
});
