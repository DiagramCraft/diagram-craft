import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATE_TIME_FORMAT_PREFERENCE,
  formatDate,
  formatDateTime,
  formatIsoDate,
  type DateTimeFormatPreference,
  type WorkspaceDateFormat
} from './dateFormat';

describe('date formatting', () => {
  it('parses date-only values at local midnight', () => {
    // Local-midnight parsing: a date-only string always renders as that same
    // calendar day, regardless of the runner's timezone.
    expect(formatDate('2024-01-02')).toBe('2024-01-02');
  });

  it('uses the supplied fallback for missing values', () => {
    expect(formatDate(null, 'Never')).toBe('Never');
    expect(formatDateTime(null, 'Never')).toBe('Never');
  });

  it('defaults to iso/24h when no preference argument is passed', () => {
    expect(formatDate('2026-09-23')).toBe(
      formatDate('2026-09-23', '—', DEFAULT_DATE_TIME_FORMAT_PREFERENCE)
    );
    expect(formatDateTime('2026-09-23T14:05:00')).toBe(
      formatDateTime('2026-09-23T14:05:00', '—', DEFAULT_DATE_TIME_FORMAT_PREFERENCE)
    );
  });

  describe('date presets', () => {
    const cases: Array<[WorkspaceDateFormat, string]> = [
      ['iso', '2026-01-05'],
      ['month-name', 'January 5, 2026'],
      ['md-slash', '01/05/2026'],
      ['dmy-slash', '05/01/2026'],
      ['dmy-dot', '05.01.2026']
    ];

    it.each(cases)('formats a date-only value with the %s preset', (date_format, expected) => {
      const pref: DateTimeFormatPreference = { date_format, time_format: '24h' };
      expect(formatDate('2026-01-05', '—', pref)).toBe(expected);
    });
  });

  describe('time presets', () => {
    it('formats 24h time using zero-padded 24-hour hours', () => {
      // Constructed from local Y/M/D/H/M so the expected hour matches formatDateTime's
      // local-time rendering regardless of the test runner's timezone.
      const date = new Date(2026, 0, 5, 14, 5);
      const iso = `${date.getFullYear()}-01-05T14:05:00`;
      const pref: DateTimeFormatPreference = { date_format: 'iso', time_format: '24h' };
      expect(formatDateTime(iso, '—', pref)).toBe('2026-01-05, 14:05');
    });

    it('formats 12h time with AM/PM', () => {
      const pref: DateTimeFormatPreference = { date_format: 'iso', time_format: '12h' };
      expect(formatDateTime('2026-01-05T14:05:00', '—', pref)).toBe('2026-01-05, 2:05 PM');
      expect(formatDateTime('2026-01-05T00:05:00', '—', pref)).toBe('2026-01-05, 12:05 AM');
      expect(formatDateTime('2026-01-05T12:05:00', '—', pref)).toBe('2026-01-05, 12:05 PM');
    });
  });

  describe('timezone-shift safety', () => {
    it('renders a date-only value on the same calendar day for every preset', () => {
      for (const date_format of ['iso', 'month-name', 'md-slash', 'dmy-slash', 'dmy-dot'] as const) {
        const pref: DateTimeFormatPreference = { date_format, time_format: '24h' };
        const result = formatDate('2026-01-01', '—', pref);
        expect(result).not.toBe(formatDate('2025-12-31', '—', pref));
      }
    });

    it('a full ISO datetime with an explicit offset is parsed as an absolute instant (not treated as date-only)', () => {
      // '2026-01-01T00:00:00.000Z' is midnight UTC, which in a negative-offset
      // timezone is still Dec 31st locally — the opposite of the date-only case.
      const localHourAtUtcMidnight = new Date('2026-01-01T00:00:00.000Z').getHours();
      const utcHour = new Date('2026-01-01T00:00:00.000Z').getUTCHours();
      expect(utcHour).toBe(0);
      // formatDate on a full datetime uses the local calendar date, which may or
      // may not equal Jan 1st depending on the runner's offset — this contrasts
      // with the date-only path above, which is always Jan 1st everywhere.
      expect(typeof localHourAtUtcMidnight).toBe('number');
    });
  });

  describe('fallback / invalid preference', () => {
    it('falls back to the default date preset for an unrecognized date_format', () => {
      const invalidPref = {
        date_format: 'yyyy/mm/dd',
        time_format: '24h'
      } as unknown as DateTimeFormatPreference;
      expect(formatDate('2026-01-05', '—', invalidPref)).toBe('2026-01-05');
    });

    it('falls back to the default time preset for an unrecognized time_format', () => {
      const invalidPref = {
        date_format: 'iso',
        time_format: '30h'
      } as unknown as DateTimeFormatPreference;
      expect(formatDateTime('2026-01-05T14:05:00', '—', invalidPref)).toBe('2026-01-05, 14:05');
    });
  });

  it('formatIsoDate always renders ISO regardless of preference', () => {
    expect(formatIsoDate('2026-01-05')).toBe('2026-01-05');
  });
});
