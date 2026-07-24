import type { CSSProperties } from 'react';

export type TimelineZoom = 'month' | 'quarter' | 'year';

export type TimelineColumn = {
  date: Date;
  label: string;
  width: number;
  isCurrent: boolean;
};

export type TimelineRange = {
  rangeStart: Date;
  rangeEnd: Date;
  columns: TimelineColumn[];
  totalWidth: number;
};

export type TimelineColumnWidths = Record<TimelineZoom, number>;

type BuildTimelineRangeArgs = {
  dates: Date[];
  zoom: TimelineZoom;
  columnWidths: TimelineColumnWidths;
  today?: Date;
  fallbackDates?: Date[];
};

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const clampTimelineValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const parseTimelineDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value === '') return null;
  const date = DATE_ONLY_RE.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTimelineDate = (
  value: unknown,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  locale = 'en-US'
) => {
  const date = value instanceof Date ? value : parseTimelineDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(locale, options);
};

export const getTimelineColumnEnd = (column: TimelineColumn, zoom: TimelineZoom): Date => {
  const date = new Date(column.date);
  if (zoom === 'month') date.setMonth(date.getMonth() + 1);
  else if (zoom === 'quarter') date.setMonth(date.getMonth() + 3);
  else date.setFullYear(date.getFullYear() + 1);
  return date;
};

export const buildTimelineColumns = (
  minDate: Date,
  maxDate: Date,
  zoom: TimelineZoom,
  columnWidths: TimelineColumnWidths,
  locale = 'en-US',
  today = new Date()
): TimelineColumn[] => {
  const width = columnWidths[zoom];
  const columns: TimelineColumn[] = [];

  if (zoom === 'month') {
    let date = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 1);
    while (date < end) {
      const isCurrent =
        date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
      const month = date.toLocaleString(locale, { month: 'short' });
      columns.push({
        date: new Date(date),
        label: `${month} '${String(date.getFullYear()).slice(2)}`,
        width,
        isCurrent
      });
      date = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    }
  } else if (zoom === 'quarter') {
    let date = new Date(minDate.getFullYear(), Math.floor(minDate.getMonth() / 3) * 3 - 3, 1);
    const end = new Date(maxDate.getFullYear(), Math.ceil((maxDate.getMonth() + 1) / 3) * 3 + 3, 1);
    while (date < end) {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
      columns.push({
        date: new Date(date),
        label: `Q${quarter} '${String(date.getFullYear()).slice(2)}`,
        width,
        isCurrent: date.getFullYear() === today.getFullYear() && quarter === currentQuarter
      });
      date = new Date(date.getFullYear(), date.getMonth() + 3, 1);
    }
  } else {
    let year = minDate.getFullYear() - 1;
    const endYear = maxDate.getFullYear() + 2;
    while (year <= endYear) {
      columns.push({
        date: new Date(year, 0, 1),
        label: String(year),
        width,
        isCurrent: year === today.getFullYear()
      });
      year++;
    }
  }

  return columns;
};

export const buildTimelineRange = ({
  dates,
  zoom,
  columnWidths,
  today = new Date(),
  fallbackDates = []
}: BuildTimelineRangeArgs): TimelineRange => {
  const resolvedDates = [today, ...dates, ...fallbackDates];
  if (resolvedDates.length < 2) {
    resolvedDates.push(new Date(today.getFullYear() + 1, 0, 1));
  }

  const minDate = new Date(Math.min(...resolvedDates.map(date => date.getTime())));
  const maxDate = new Date(Math.max(...resolvedDates.map(date => date.getTime())));
  const columns = buildTimelineColumns(minDate, maxDate, zoom, columnWidths, 'en-US', today);
  const rangeStart = columns[0]?.date ?? minDate;
  const rangeEnd =
    columns.length > 0 ? getTimelineColumnEnd(columns[columns.length - 1]!, zoom) : maxDate;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  return { rangeStart, rangeEnd, columns, totalWidth };
};

export const dateToTimelinePx = (
  date: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
  totalWidth: number
) => {
  if (!date) return 0;
  const span = rangeEnd.getTime() - rangeStart.getTime();
  if (span <= 0) return 0;
  return clampTimelineValue(
    ((date.getTime() - rangeStart.getTime()) / span) * totalWidth,
    0,
    totalWidth
  );
};

export const stringDateToTimelinePx = (
  value: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  totalWidth: number
) => {
  const date = parseTimelineDate(value);
  if (!date) return null;
  return dateToTimelinePx(date, rangeStart, rangeEnd, totalWidth);
};

export const getTodayTimelinePx = (
  today: Date,
  rangeStart: Date,
  rangeEnd: Date,
  totalWidth: number
) => {
  const span = rangeEnd.getTime() - rangeStart.getTime();
  if (totalWidth <= 0 || span <= 0) return null;
  return clampTimelineValue(
    ((today.getTime() - rangeStart.getTime()) / span) * totalWidth,
    0,
    totalWidth
  );
};

export const getTimelineMinWidthStyle = (
  labelWidth: number,
  totalWidth: number,
  style?: CSSProperties
): CSSProperties => ({
  minWidth: labelWidth + totalWidth,
  position: 'relative',
  ...style
});
