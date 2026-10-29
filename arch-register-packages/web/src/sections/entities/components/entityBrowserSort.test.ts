import { describe, expect, it } from 'vitest';
import type { BrowserEntityRecord } from './entityBrowserState';
import {
  compareBySort,
  encodeFieldSort,
  encodeSort,
  getSortValue,
  nextSort,
  parseSort
} from './entityBrowserSort';

const entity = (fields: Record<string, unknown>) => fields as unknown as BrowserEntityRecord;

describe('parseSort / encodeSort', () => {
  it('parses field sorts, including ids containing colons', () => {
    expect(parseSort('field:residual_risk_score:desc')).toEqual({
      key: 'residual_risk_score',
      dir: 'desc'
    });
    expect(parseSort('field:_projection:Policy:asc')).toEqual({
      key: '_projection:Policy',
      dir: 'asc'
    });
  });

  it('maps the legacy ascending sorts to columns', () => {
    expect(parseSort('name')).toEqual({ key: '_name', dir: 'asc' });
    expect(parseSort('owner')).toEqual({ key: '_owner', dir: 'asc' });
    expect(parseSort('completeness')).toEqual({ key: '_completeness', dir: 'asc' });
    expect(parseSort('date:due')).toEqual({ key: 'due', dir: 'asc' });
    expect(parseSort('type')).toBeNull();
  });

  it('keeps plain name for ascending name sort', () => {
    expect(encodeSort({ key: '_name', dir: 'asc' })).toBe('name');
    expect(encodeSort({ key: '_name', dir: 'desc' })).toBe('field:_name:desc');
    expect(encodeFieldSort('x', 'asc')).toBe('field:x:asc');
  });
});

describe('nextSort', () => {
  it('starts ascending on a new column and flips on repeat', () => {
    expect(nextSort('name', 'score')).toBe('field:score:asc');
    expect(nextSort('field:score:asc', 'score')).toBe('field:score:desc');
    expect(nextSort('field:score:desc', 'score')).toBe('field:score:asc');
    expect(nextSort('name', '_name')).toBe('field:_name:desc');
    expect(nextSort('field:_name:desc', '_name')).toBe('name');
  });
});

describe('getSortValue', () => {
  it('reads standard, projection and schema fields', () => {
    const e = entity({
      _name: 'A',
      _owner: { name: 'Olle' },
      _projections: { Policy: 'P1' },
      score: [7],
      done: true
    });
    expect(getSortValue(e, '_name')).toBe('A');
    expect(getSortValue(e, '_owner')).toBe('Olle');
    expect(getSortValue(e, '_projection:Policy')).toBe('P1');
    expect(getSortValue(e, 'score')).toBe(7);
    expect(getSortValue(e, 'done')).toBe(1);
    expect(getSortValue(e, 'missing')).toBeNull();
  });
});

describe('compareBySort', () => {
  const rows = [
    entity({ _name: 'a', score: 3 }),
    entity({ _name: 'b' }),
    entity({ _name: 'c', score: 12 }),
    entity({ _name: 'd', score: 5 })
  ];
  const order = (dir: 'asc' | 'desc') =>
    [...rows].sort((a, b) => compareBySort(a, b, { key: 'score', dir })).map(r => r._name);

  it('sorts numbers numerically and keeps empty values last in both directions', () => {
    expect(order('asc')).toEqual(['a', 'd', 'c', 'b']);
    expect(order('desc')).toEqual(['c', 'd', 'a', 'b']);
  });

  it('sorts text naturally', () => {
    const items = [entity({ _name: 'item10' }), entity({ _name: 'item2' })];
    items.sort((a, b) => compareBySort(a, b, { key: '_name', dir: 'asc' }));
    expect(items.map(i => i._name)).toEqual(['item2', 'item10']);
  });
});
