import { describe, expect, it } from 'vitest';
import { buildDateBuckets } from './dateBucketLogic';

const today = new Date(2026, 9, 7); // 2026-10-07

describe('buildDateBuckets', () => {
  const records = [
    { d: '2026-10-20', v: { amount: 100, currency: 'USD' } },
    { d: '2026-12-01', v: { amount: 50, currency: 'USD' } },
    { d: '2026-09-01', v: { amount: 10, currency: 'USD' } },
    { d: '2030-01-01', v: { amount: 999, currency: 'USD' } }
  ];

  it('creates one bucket per month starting this month', () => {
    const buckets = buildDateBuckets([], { dateFieldId: 'd', bucketCount: 3, today });
    expect(buckets.map(b => b.key)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('sums the measure, folds overdue and drops out-of-window records', () => {
    const buckets = buildDateBuckets(records, {
      dateFieldId: 'd',
      bucketCount: 3,
      measureFieldId: 'v',
      foldOverdue: true,
      urgentWithinDays: 30,
      today
    });
    expect(buckets[0]).toMatchObject({ count: 2, total: 110, urgent: true });
    expect(buckets[1]).toMatchObject({ count: 0, urgent: false });
    expect(buckets[2]).toMatchObject({ count: 1, total: 50, urgent: false, currency: 'USD' });
  });

  it('drops overdue records when not folding', () => {
    const buckets = buildDateBuckets(records, { dateFieldId: 'd', bucketCount: 3, today });
    expect(buckets[0]!.count).toBe(1);
  });
});
