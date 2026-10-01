import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  filterChangeCaseRows,
  isChangeCaseStatus
} from './changeCaseTableLogic';

const row = (
  id: string,
  status: 'open' | 'completed' | 'cancelled',
  name: string,
  requesterName: string | null = null
) => ({
  case: { id, status },
  entity: { _name: name, _publicId: `DE-${id}` },
  requesterName
});

const rows = [
  row('1', 'open', 'Order Records', 'Alice'),
  row('2', 'open', 'Inventory Levels', 'Bob'),
  row('3', 'completed', 'Product Catalog Data', 'Alice'),
  row('4', 'cancelled', 'Marketing Consent', null)
];

describe('isChangeCaseStatus', () => {
  it('accepts only the three case statuses', () => {
    expect(isChangeCaseStatus('open')).toBe(true);
    expect(isChangeCaseStatus('completed')).toBe(true);
    expect(isChangeCaseStatus('cancelled')).toBe(true);
    expect(isChangeCaseStatus('rejected')).toBe(false);
    expect(isChangeCaseStatus(undefined)).toBe(false);
  });
});

describe('countByStatus', () => {
  it('tallies rows per status, including zero counts', () => {
    expect(countByStatus(rows)).toEqual({ open: 2, completed: 1, cancelled: 1 });
    expect(countByStatus([])).toEqual({ open: 0, completed: 0, cancelled: 0 });
  });
});

describe('filterChangeCaseRows', () => {
  it('returns everything without a status or query', () => {
    expect(filterChangeCaseRows(rows, { status: undefined, query: '' })).toHaveLength(4);
  });

  it('filters by status', () => {
    expect(
      filterChangeCaseRows(rows, { status: 'open', query: '' }).map(r => r.case.id)
    ).toEqual(['1', '2']);
  });

  it('matches the query against name, public id and requester, case-insensitively', () => {
    const ids = (query: string) =>
      filterChangeCaseRows(rows, { status: undefined, query }).map(r => r.case.id);
    expect(ids('inventory')).toEqual(['2']);
    expect(ids('DE-3')).toEqual(['3']);
    expect(ids('  alice ')).toEqual(['1', '3']);
  });

  it('combines status and query', () => {
    expect(
      filterChangeCaseRows(rows, { status: 'open', query: 'alice' }).map(r => r.case.id)
    ).toEqual(['1']);
  });
});
