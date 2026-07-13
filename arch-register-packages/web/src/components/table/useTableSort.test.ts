import { describe, expect, it } from 'vitest';
import { nextSortState, sortRows } from './useTableSort';

describe('nextSortState', () => {
  it('starts ascending for a new key', () => {
    expect(nextSortState(null, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('flips direction when toggling the same key', () => {
    expect(nextSortState({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
    expect(nextSortState({ key: 'name', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('resets to ascending when switching to a different key', () => {
    expect(nextSortState({ key: 'name', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'asc' });
  });
});

describe('sortRows', () => {
  type Row = { name: string };
  const rows: Row[] = [{ name: 'b' }, { name: 'a' }, { name: 'c' }];
  const comparators = { name: (a: Row, b: Row) => a.name.localeCompare(b.name) };

  it('returns rows unchanged when sort is null', () => {
    const result = sortRows(rows, null, comparators);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  it('sorts ascending', () => {
    expect(sortRows(rows, { key: 'name', dir: 'asc' }, comparators).map(r => r.name)).toEqual([
      'a',
      'b',
      'c'
    ]);
  });

  it('sorts descending by reversing the ascending order', () => {
    expect(sortRows(rows, { key: 'name', dir: 'desc' }, comparators).map(r => r.name)).toEqual([
      'c',
      'b',
      'a'
    ]);
  });

  it('does not mutate the input array', () => {
    const copy = [...rows];
    sortRows(rows, { key: 'name', dir: 'asc' }, comparators);
    expect(rows).toEqual(copy);
  });
});
