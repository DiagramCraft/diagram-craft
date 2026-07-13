import { describe, expect, it } from 'vitest';
import { compareBy, compareDates, compareNumbers, compareStrings } from './compare';

describe('compareStrings', () => {
  it('sorts alphabetically via localeCompare', () => {
    expect(compareStrings('a', 'b')).toBeLessThan(0);
    expect(compareStrings('b', 'a')).toBeGreaterThan(0);
    expect(compareStrings('a', 'a')).toBe(0);
  });

  it('places nullish values last', () => {
    expect(compareStrings(null, 'a')).toBeGreaterThan(0);
    expect(compareStrings('a', null)).toBeLessThan(0);
    expect(compareStrings(undefined, 'a')).toBeGreaterThan(0);
    expect(compareStrings(null, undefined)).toBe(0);
  });
});

describe('compareNumbers', () => {
  it('sorts ascending', () => {
    expect(compareNumbers(1, 2)).toBeLessThan(0);
    expect(compareNumbers(2, 1)).toBeGreaterThan(0);
    expect(compareNumbers(1, 1)).toBe(0);
  });

  it('places nullish values last', () => {
    expect(compareNumbers(null, 1)).toBeGreaterThan(0);
    expect(compareNumbers(1, null)).toBeLessThan(0);
    expect(compareNumbers(undefined, undefined)).toBe(0);
  });
});

describe('compareDates', () => {
  it('sorts ISO strings chronologically', () => {
    expect(compareDates('2024-01-01', '2024-02-01')).toBeLessThan(0);
    expect(compareDates('2024-02-01', '2024-01-01')).toBeGreaterThan(0);
  });

  it('sorts Date instances chronologically', () => {
    expect(compareDates(new Date('2024-01-01'), new Date('2024-02-01'))).toBeLessThan(0);
  });

  it('places nullish values last', () => {
    expect(compareDates(null, '2024-01-01')).toBeGreaterThan(0);
    expect(compareDates('2024-01-01', null)).toBeLessThan(0);
    expect(compareDates(null, null)).toBe(0);
  });
});

describe('compareBy', () => {
  it('projects a value before comparing', () => {
    const cmp = compareBy((row: { name: string }) => row.name, compareStrings);
    expect(cmp({ name: 'a' }, { name: 'b' })).toBeLessThan(0);
  });
});
