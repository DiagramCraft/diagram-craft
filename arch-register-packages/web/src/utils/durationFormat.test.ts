import { describe, expect, it } from 'vitest';
import { durationUnitLabel, formatDurationValue } from './durationFormat';

describe('formatDurationValue', () => {
  it('formats with singular and plural units', () => {
    expect(formatDurationValue({ amount: 3, unit: 'years' })).toBe('3 years');
    expect(formatDurationValue({ amount: 1, unit: 'months' })).toBe('1 month');
    expect(formatDurationValue({ amount: 0, unit: 'days' })).toBe('0 days');
  });

  it('falls back to the raw value for malformed input', () => {
    expect(formatDurationValue({ amount: 3, unit: 'decades' })).toBe('[object Object]');
    expect(formatDurationValue('3 years')).toBe('3 years');
  });
});

describe('durationUnitLabel', () => {
  it('capitalises the plural unit name', () => {
    expect(durationUnitLabel('weeks')).toBe('Weeks');
  });
});
