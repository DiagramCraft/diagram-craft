import { describe, expect, it } from 'vitest';
import { durationToDays, parseDurationValue } from './durationValue';

describe('parseDurationValue', () => {
  it('accepts structured values', () => {
    expect(parseDurationValue({ amount: 3, unit: 'years' })).toEqual({ amount: 3, unit: 'years' });
  });

  it('parses strings with full and short unit names', () => {
    expect(parseDurationValue('3 years')).toEqual({ amount: 3, unit: 'years' });
    expect(parseDurationValue('1 year')).toEqual({ amount: 1, unit: 'years' });
    expect(parseDurationValue('6m')).toEqual({ amount: 6, unit: 'months' });
    expect(parseDurationValue('2 Weeks')).toEqual({ amount: 2, unit: 'weeks' });
  });

  it('rejects unknown units, negative or non-finite amounts and other shapes', () => {
    expect(parseDurationValue('3 fortnights')).toBeNull();
    expect(parseDurationValue({ amount: -1, unit: 'days' })).toBeNull();
    expect(parseDurationValue({ amount: Number.NaN, unit: 'days' })).toBeNull();
    expect(parseDurationValue({ amount: 3 })).toBeNull();
    expect(parseDurationValue(3)).toBeNull();
    expect(parseDurationValue('years')).toBeNull();
  });
});

describe('durationToDays', () => {
  it('normalises across units so ranges compare consistently', () => {
    expect(durationToDays({ amount: 1, unit: 'weeks' })).toBe(7);
    expect(durationToDays({ amount: 1, unit: 'years' })).toBeGreaterThan(
      durationToDays({ amount: 11, unit: 'months' })
    );
    expect(durationToDays({ amount: 1, unit: 'years' })).toBeCloseTo(
      durationToDays({ amount: 12, unit: 'months' }),
      0
    );
  });
});
