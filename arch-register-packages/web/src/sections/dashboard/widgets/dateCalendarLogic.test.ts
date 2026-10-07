import { describe, expect, it } from 'vitest';
import { buildDateCalendar } from './dateCalendarLogic';

const today = new Date(2026, 9, 7); // 7 Oct 2026

const rec = (uid: string, date: unknown, cost?: number) => ({
  _uid: uid,
  due: date,
  cost: cost === undefined ? undefined : { amount: cost, currency: 'SEK' }
});

describe('buildDateCalendar', () => {
  it('buckets by month, folds overdue into the current month and counts the rest', () => {
    const { cells, beyondCount, undatedCount } = buildDateCalendar(
      [
        rec('a', '2026-10-20', 100),
        rec('b', '2026-01-01', 50),
        rec('c', '2026-12-31'),
        rec('d', '2030-01-01'),
        rec('e', undefined)
      ],
      { dateFieldId: 'due', period: 'month', periodCount: 3, valueFieldId: 'cost', today }
    );
    expect(cells.map(cell => cell.records.map(r => r._uid))).toEqual([['a', 'b'], [], ['c']]);
    expect(cells[0]!.current).toBe(true);
    expect(cells[0]!.total).toEqual({ amount: 150, currency: 'SEK' });
    expect(beyondCount).toBe(1);
    expect(undatedCount).toBe(1);
  });

  it('buckets by Monday-based week', () => {
    const { cells } = buildDateCalendar([rec('a', '2026-10-11'), rec('b', '2026-10-12')], {
      dateFieldId: 'due',
      period: 'week',
      periodCount: 2,
      today
    });
    expect(cells[0]!.label).toBe('This week');
    expect(cells.map(cell => cell.records.map(r => r._uid))).toEqual([['a'], ['b']]);
  });
});
