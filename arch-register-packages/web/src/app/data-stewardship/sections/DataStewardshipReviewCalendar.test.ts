import { describe, expect, it } from 'vitest';
import type { DataStewardshipQueueItem } from '../dataStewardshipQueue';
import { buildReviewCalendarWeeks } from './DataStewardshipReviewCalendar';

const item = (id: string, dueAt: string | null): DataStewardshipQueueItem =>
  ({
    case: { id, dueAt, caseKind: 'field-date-reminder', payload: {} },
    assignment: null,
    dataset: { _uid: `ds-${id}`, _publicId: id.toUpperCase(), _name: `Dataset ${id}` }
  }) as never;

describe('buildReviewCalendarWeeks', () => {
  const today = new Date('2026-09-30T00:00:00'); // Wednesday

  it('buckets an item into its due week', () => {
    const weeks = buildReviewCalendarWeeks([item('a', '2026-10-08')], today);
    const week = weeks.find(w => w.items.some(i => i.case.id === 'a'));
    expect(week?.label).toContain('w/c');
    expect(weeks[0]!.items).toHaveLength(0);
  });

  it('folds an overdue item into the current week', () => {
    const weeks = buildReviewCalendarWeeks([item('a', '2026-09-01')], today);
    expect(weeks[0]!.items.map(i => i.case.id)).toEqual(['a']);
    expect(weeks[0]!.label).toBe('This week');
    expect(weeks[0]!.isNow).toBe(true);
  });

  it('excludes an item with no due date', () => {
    const weeks = buildReviewCalendarWeeks([item('a', null)], today);
    expect(weeks.every(w => w.items.length === 0)).toBe(true);
  });

  it('excludes an item due beyond the six-week window', () => {
    const weeks = buildReviewCalendarWeeks([item('a', '2027-01-01')], today);
    expect(weeks.every(w => w.items.length === 0)).toBe(true);
  });

  it('builds six weeks with the current one marked isNow', () => {
    const weeks = buildReviewCalendarWeeks([], today);
    expect(weeks).toHaveLength(6);
    expect(weeks.filter(w => w.isNow)).toHaveLength(1);
    expect(weeks[0]!.isNow).toBe(true);
  });
});
