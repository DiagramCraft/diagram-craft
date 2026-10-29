import { describe, expect, it } from 'vitest';
import { toEffectiveAt, toLocalDate } from './baselineEffectiveDate';

describe('baseline effective date', () => {
  const now = new Date(2026, 9, 26, 15, 30, 0);

  it('formats a local date', () => {
    expect(toLocalDate(now)).toBe('2026-10-26');
  });

  it('uses the current moment when the picked day is today', () => {
    expect(toEffectiveAt('2026-10-26', now)).toBe(now.toISOString());
  });

  it('uses the end of the local day for any other day', () => {
    expect(toEffectiveAt('2026-10-20', now)).toBe(
      new Date(2026, 9, 20, 23, 59, 59, 999).toISOString()
    );
  });

  it('returns null for an empty or invalid date', () => {
    expect(toEffectiveAt('', now)).toBeNull();
  });
});
