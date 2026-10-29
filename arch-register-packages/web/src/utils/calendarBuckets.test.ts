import { describe, expect, test } from 'vitest';
import { bucketByPeriod } from './calendarBuckets';

type Item = { id: string; date: string | null };

const weekParams = {
  today: new Date('2026-09-30T00:00:00'), // Wednesday
  periodCount: 6,
  getItemDate: (item: Item) => (item.date ? new Date(item.date) : null),
  startOfPeriod: (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return start;
  },
  periodStartAt: (currentPeriodStart: Date, index: number) => {
    const start = new Date(currentPeriodStart);
    start.setDate(start.getDate() + index * 7);
    return start;
  },
  periodKey: (date: Date) => date.toISOString().slice(0, 10),
  periodLabel: (periodStart: Date, index: number) =>
    index === 0 ? 'This week' : periodStart.toISOString().slice(0, 10)
};

describe('bucketByPeriod', () => {
  test('buckets an item into its own period', () => {
    const { buckets } = bucketByPeriod({ items: [{ id: 'a', date: '2026-10-08' }], ...weekParams });
    expect(buckets[1]!.items.map(i => i.id)).toEqual(['a']);
    expect(buckets[0]!.items).toHaveLength(0);
  });

  test('folds an overdue item into the current period', () => {
    const { buckets } = bucketByPeriod({ items: [{ id: 'a', date: '2026-09-01' }], ...weekParams });
    expect(buckets[0]!.items.map(i => i.id)).toEqual(['a']);
  });

  test('counts items with no date as unbucketed', () => {
    const { unbucketedCount, buckets } = bucketByPeriod({
      items: [{ id: 'a', date: null }],
      ...weekParams
    });
    expect(unbucketedCount).toBe(1);
    expect(buckets.every(b => b.items.length === 0)).toBe(true);
  });

  test('counts items with an unparseable date as unbucketed', () => {
    const { unbucketedCount } = bucketByPeriod({
      items: [{ id: 'a', date: 'not-a-date' }],
      ...weekParams
    });
    expect(unbucketedCount).toBe(1);
  });

  test('counts items beyond the last period as beyond', () => {
    const { beyondCount, buckets } = bucketByPeriod({
      items: [{ id: 'a', date: '2027-01-01' }],
      ...weekParams
    });
    expect(beyondCount).toBe(1);
    expect(buckets.every(b => b.items.length === 0)).toBe(true);
  });

  test('builds the requested number of buckets with the current one first', () => {
    const { buckets } = bucketByPeriod({ items: [], ...weekParams });
    expect(buckets).toHaveLength(6);
    expect(buckets[0]!.label).toBe('This week');
  });
});
