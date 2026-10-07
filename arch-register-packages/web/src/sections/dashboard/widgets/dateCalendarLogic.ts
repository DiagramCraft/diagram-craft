import { bucketByPeriod } from '../../../utils/calendarBuckets';
import { sumMeasured } from './fieldAggregation';

export type CalendarPeriod = 'month' | 'week';

export type DateCalendarCell<T> = {
  key: string;
  label: string;
  /** True for the cell holding today. */
  current: boolean;
  records: T[];
  total?: { amount: number; currency?: string };
};

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const WEEK_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const pad = (value: number): string => String(value).padStart(2, '0');
const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
/** Monday-based week start. */
const startOfWeek = (date: Date): Date => {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
};

export const parseCalendarDate = (raw: unknown): Date | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length < 10) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const daysFromToday = (date: Date, today: Date): number =>
  Math.round(
    (date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000
  );

/**
 * Buckets records into `periodCount` consecutive months/weeks starting at the current one, by the
 * value of `dateFieldId`. Overdue records fold into the current cell; records past the window or
 * without a date are excluded and counted.
 */
export const buildDateCalendar = <T extends Record<string, unknown>>(
  records: readonly T[],
  options: {
    dateFieldId: string;
    period: CalendarPeriod;
    periodCount: number;
    valueFieldId?: string;
    today?: Date;
  }
): { cells: DateCalendarCell<T>[]; beyondCount: number; undatedCount: number } => {
  const today = options.today ?? new Date();
  const monthly = options.period === 'month';
  const startOfPeriod = monthly ? startOfMonth : startOfWeek;

  const { buckets, beyondCount, unbucketedCount } = bucketByPeriod({
    items: records,
    today,
    periodCount: options.periodCount,
    getItemDate: record => parseCalendarDate(record[options.dateFieldId]),
    startOfPeriod,
    periodStartAt: (current, index) =>
      monthly
        ? new Date(current.getFullYear(), current.getMonth() + index, 1)
        : new Date(current.getFullYear(), current.getMonth(), current.getDate() + index * 7),
    periodKey: monthly ? date => dayKey(startOfMonth(date)) : dayKey,
    periodLabel: (periodStart, index) =>
      monthly
        ? MONTH_LABEL.format(periodStart)
        : index === 0
          ? 'This week'
          : `w/c ${WEEK_LABEL.format(periodStart)}`
  });

  const currentKey = buckets[0]?.key;
  return {
    cells: buckets.map(({ key, label, items }) => ({
      key,
      label,
      current: key === currentKey,
      records: items,
      total: options.valueFieldId ? sumMeasured(items, options.valueFieldId) : undefined
    })),
    beyondCount,
    undatedCount: unbucketedCount
  };
};
