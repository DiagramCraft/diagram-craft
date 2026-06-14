import { describe, expect, it } from 'vitest';
import {
  buildTimelineRange,
  dateToTimelinePx,
  formatTimelineDate,
  getTodayTimelinePx,
  parseTimelineDate,
  type TimelineColumnWidths
} from './timelineUtils';

const COLUMN_WIDTHS: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

describe('timelineUtils', () => {
  it('parses both date-only and datetime strings', () => {
    const dateOnly = parseTimelineDate('2026-06-14');
    expect(dateOnly?.getFullYear()).toBe(2026);
    expect(dateOnly?.getMonth()).toBe(5);
    expect(dateOnly?.getDate()).toBe(14);
    expect(parseTimelineDate('2026-06-14T10:30:00Z')?.toISOString()).toBe('2026-06-14T10:30:00.000Z');
    expect(parseTimelineDate('')).toBeNull();
    expect(parseTimelineDate('not-a-date')).toBeNull();
  });

  it('builds quarter columns and marks the current quarter', () => {
    const today = new Date('2026-06-14T00:00:00Z');
    const range = buildTimelineRange({
      dates: [new Date('2026-03-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z')],
      zoom: 'quarter',
      columnWidths: COLUMN_WIDTHS,
      today
    });

    expect(range.columns.map(column => column.label)).toEqual([
      "Q4 '25",
      "Q1 '26",
      "Q2 '26",
      "Q3 '26",
      "Q4 '26",
      "Q1 '27"
    ]);
    expect(range.columns.find(column => column.isCurrent)?.label).toBe("Q2 '26");
  });

  it('applies fallback dates when no dated records exist', () => {
    const today = new Date('2026-06-14T00:00:00Z');
    const range = buildTimelineRange({
      dates: [],
      zoom: 'year',
      columnWidths: COLUMN_WIDTHS,
      today,
      fallbackDates: [new Date('2025-01-01T00:00:00Z'), new Date('2027-12-31T00:00:00Z')]
    });

    expect(range.columns[0]?.label).toBe('2024');
    expect(range.columns.at(-1)?.label).toBe('2029');
  });

  it('clamps pixel mapping and today position to the timeline bounds', () => {
    const rangeStart = new Date('2026-01-01T00:00:00Z');
    const rangeEnd = new Date('2027-01-01T00:00:00Z');

    expect(dateToTimelinePx(new Date('2025-01-01T00:00:00Z'), rangeStart, rangeEnd, 1200)).toBe(0);
    expect(dateToTimelinePx(new Date('2028-01-01T00:00:00Z'), rangeStart, rangeEnd, 1200)).toBe(1200);
    expect(getTodayTimelinePx(new Date('2026-06-14T00:00:00Z'), rangeStart, rangeEnd, 1200)).toBeGreaterThan(0);
  });

  it('formats timeline dates consistently', () => {
    expect(formatTimelineDate('2026-06-14')).toBe('Jun 14, 2026');
    expect(formatTimelineDate(null)).toBe('—');
  });
});
