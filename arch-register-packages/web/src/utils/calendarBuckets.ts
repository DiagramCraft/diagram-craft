export type CalendarBucket<T> = { key: string; periodStart: Date; label: string; items: T[] };

/**
 * Buckets `items` into `periodCount` consecutive periods (weeks, months, ...) starting at
 * `today`'s period. An item whose date falls before the current period is folded into the
 * current bucket instead of being dropped off the front of the grid; an item whose date falls
 * after the last bucket is excluded and counted in `beyondCount`; an item with no date
 * (`getItemDate` returns `null`) is excluded and counted in `unbucketedCount`.
 *
 * Extracted from `VendorContractsCalendar`'s and `DataStewardshipReviewCalendar`'s independently
 * built calendar grids (#3497) — both bucketed items into a fixed window of consecutive periods
 * with this exact "fold overdue into current, count what falls outside the window" behavior,
 * differing only in period length (week vs. month) and how an item's date is read.
 */
export const bucketByPeriod = <T>(params: {
  items: readonly T[];
  today: Date;
  periodCount: number;
  getItemDate: (item: T) => Date | null;
  startOfPeriod: (date: Date) => Date;
  periodStartAt: (currentPeriodStart: Date, index: number) => Date;
  periodKey: (date: Date) => string;
  periodLabel: (periodStart: Date, index: number) => string;
}): { buckets: CalendarBucket<T>[]; beyondCount: number; unbucketedCount: number } => {
  const {
    items,
    today,
    periodCount,
    getItemDate,
    startOfPeriod,
    periodStartAt,
    periodKey,
    periodLabel
  } = params;

  const currentPeriodStart = startOfPeriod(today);
  const currentKey = periodKey(currentPeriodStart);

  const periodStarts: Date[] = [];
  for (let i = 0; i < periodCount; i++) {
    periodStarts.push(periodStartAt(currentPeriodStart, i));
  }
  const lastKey = periodKey(periodStarts[periodStarts.length - 1]!);

  const buckets = new Map<string, CalendarBucket<T>>(
    periodStarts.map((periodStart, index) => {
      const key = periodKey(periodStart);
      return [key, { key, periodStart, label: periodLabel(periodStart, index), items: [] }];
    })
  );

  let beyondCount = 0;
  let unbucketedCount = 0;
  for (const item of items) {
    const date = getItemDate(item);
    if (!date || Number.isNaN(date.getTime())) {
      unbucketedCount++;
      continue;
    }
    const itemPeriodStart = startOfPeriod(date);
    const key = itemPeriodStart < currentPeriodStart ? currentKey : periodKey(itemPeriodStart);
    if (key > lastKey) {
      beyondCount++;
      continue;
    }
    buckets.get(key)?.items.push(item);
  }

  return { buckets: [...buckets.values()], beyondCount, unbucketedCount };
};
