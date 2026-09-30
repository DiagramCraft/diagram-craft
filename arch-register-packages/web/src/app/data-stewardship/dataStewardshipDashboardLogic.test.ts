import { describe, expect, it } from 'vitest';
import type { DataStewardshipQueueItem } from './dataStewardshipQueue';
import {
  countDueWithin,
  effectiveCaseKinds,
  filterByCaseKinds,
  renderSubtext,
  sortByDueDate
} from './dataStewardshipDashboardLogic';

const NOW = new Date('2026-01-10T00:00:00Z');

const item = (id: string, caseKind: string, dueAt: string | null): DataStewardshipQueueItem =>
  ({ case: { id, caseKind, dueAt }, assignment: null, dataset: {} }) as never;

describe('dataStewardshipDashboardLogic', () => {
  const items = [
    item('a', 'entity.change-case', '2026-01-12T00:00:00Z'),
    item('b', 'entity.deprecation', '2026-01-01T00:00:00Z'),
    item('c', 'field-date-reminder', '2026-03-01T00:00:00Z'),
    item('d', 'field-date-reminder', null)
  ];

  it('counts due-within including overdue and excluding undated', () => {
    expect(countDueWithin(items, 7, NOW)).toBe(2);
  });

  it('sorts oldest first with undated first', () => {
    expect(sortByDueDate(items).map(i => i.case.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('filters by case kinds, empty means all', () => {
    expect(filterByCaseKinds(items, ['entity.deprecation']).map(i => i.case.id)).toEqual(['b']);
    expect(filterByCaseKinds(items, [])).toHaveLength(4);
    expect(effectiveCaseKinds([])).toContain('entity.change-case');
  });

  it('renders subtext placeholders', () => {
    expect(renderSubtext('{due} of {count} soon', 5, 2)).toBe('2 of 5 soon');
  });
});
