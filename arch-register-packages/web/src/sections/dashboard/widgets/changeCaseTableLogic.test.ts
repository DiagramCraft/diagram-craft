import { describe, expect, it } from 'vitest';
import { filterByStatus, isChangeCaseStatus } from './changeCaseTableLogic';

const row = (id: string, status: 'open' | 'completed' | 'cancelled') => ({
  case: { id, status }
});

const rows = [
  row('1', 'open'),
  row('2', 'open'),
  row('3', 'completed'),
  row('4', 'cancelled')
];

describe('isChangeCaseStatus', () => {
  it('accepts only the three case statuses', () => {
    expect(isChangeCaseStatus('open')).toBe(true);
    expect(isChangeCaseStatus('completed')).toBe(true);
    expect(isChangeCaseStatus('cancelled')).toBe(true);
    expect(isChangeCaseStatus('rejected')).toBe(false);
    expect(isChangeCaseStatus('')).toBe(false);
    expect(isChangeCaseStatus(undefined)).toBe(false);
  });
});

describe('filterByStatus', () => {
  it('returns every row without a status', () => {
    expect(filterByStatus(rows, undefined)).toHaveLength(4);
  });

  it('keeps only rows in the given status', () => {
    expect(filterByStatus(rows, 'open').map(r => r.case.id)).toEqual(['1', '2']);
    expect(filterByStatus(rows, 'cancelled').map(r => r.case.id)).toEqual(['4']);
  });
});
