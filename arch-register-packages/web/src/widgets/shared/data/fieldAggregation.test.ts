import { describe, expect, it } from 'vitest';
import { formatMeasured, measuredValue, sumMeasured } from './fieldAggregation';

describe('measuredValue', () => {
  it('reads numbers and currency objects', () => {
    expect(measuredValue(3)).toEqual({ amount: 3 });
    expect(measuredValue({ amount: 5, currency: 'USD' })).toEqual({ amount: 5, currency: 'USD' });
    expect(measuredValue([{ amount: 5, currency: 'SEK' }])).toEqual({ amount: 5, currency: 'SEK' });
  });
  it('ignores non-numeric values', () => {
    expect(measuredValue('x')).toBeUndefined();
    expect(measuredValue(null)).toBeUndefined();
    expect(measuredValue({ amount: 'a' })).toBeUndefined();
  });
});

describe('sumMeasured', () => {
  it('sums and keeps a shared currency', () => {
    const rows = [{ c: { amount: 1, currency: 'USD' } }, { c: { amount: 2, currency: 'USD' } }, {}];
    expect(sumMeasured(rows, 'c')).toEqual({ amount: 3, currency: 'USD' });
  });
  it('drops the currency when mixed', () => {
    const rows = [{ c: { amount: 1, currency: 'USD' } }, { c: { amount: 2, currency: 'EUR' } }];
    expect(sumMeasured(rows, 'c').currency).toBeUndefined();
  });
});

describe('formatMeasured', () => {
  it('formats plain numbers', () => {
    expect(formatMeasured(1200, undefined)).toMatch(/1.?200/);
  });
});
