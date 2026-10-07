import { measuredValue } from './fieldAggregation';

export type DateBucket = {
  /** `YYYY-MM` */
  key: string;
  /** First day of the month. */
  start: Date;
  count: number;
  total: number;
  currency?: string;
  urgent: boolean;
};

export const daysBetween = (dateStr: string, today: Date): number => {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - todayMidnight.getTime()) / 86_400_000);
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Buckets records by the month of a date field, starting at the current month. Past dates fold into
 * the first bucket when `foldOverdue` is set (otherwise they are dropped); dates beyond the window
 * are dropped. A bucket is `urgent` when it holds a record due within `urgentWithinDays` (or overdue).
 */
export const buildDateBuckets = (
  records: Array<Record<string, unknown>>,
  options: {
    dateFieldId: string;
    bucketCount: number;
    measureFieldId?: string;
    foldOverdue?: boolean;
    urgentWithinDays?: number;
    today?: Date;
  }
): DateBucket[] => {
  const today = options.today ?? new Date();
  const buckets: DateBucket[] = Array.from({ length: options.bucketCount }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { key: monthKey(start), start, count: 0, total: 0, urgent: false };
  });
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
  const todayKey = monthKey(today);

  for (const record of records) {
    const raw = record[options.dateFieldId];
    const date = Array.isArray(raw) ? raw[0] : raw;
    if (typeof date !== 'string' || date.length < 10) continue;
    const days = daysBetween(date, today);
    const overdue = days < 0;
    const bucket = overdue
      ? options.foldOverdue
        ? byKey.get(todayKey)
        : undefined
      : byKey.get(date.slice(0, 7));
    if (!bucket) continue;
    bucket.count += 1;
    if (options.measureFieldId) {
      const value = measuredValue(record[options.measureFieldId]);
      if (value) {
        bucket.total += value.amount;
        if (value.currency) bucket.currency = bucket.currency ?? value.currency;
      }
    }
    if (overdue || (options.urgentWithinDays !== undefined && days <= options.urgentWithinDays)) {
      bucket.urgent = true;
    }
  }
  return buckets;
};
