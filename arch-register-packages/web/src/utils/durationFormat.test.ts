import { describe, expect, it } from 'vitest';
import { durationToDays } from './durationFormat';

describe('durationToDays', () => {
  it('converts each unit', () => {
    expect(durationToDays({ amount: 3, unit: 'days' })).toBe(3);
    expect(durationToDays({ amount: 2, unit: 'weeks' })).toBe(14);
    expect(durationToDays({ amount: 1, unit: 'months' })).toBe(30.4375);
    expect(durationToDays({ amount: 1, unit: 'years' })).toBe(365.25);
  });

  it('returns null for non-durations', () => {
    expect(durationToDays(30)).toBeNull();
    expect(durationToDays(null)).toBeNull();
    expect(durationToDays({ amount: 1, unit: 'decades' })).toBeNull();
  });
});
