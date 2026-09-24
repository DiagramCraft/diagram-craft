import { describe, expect, it } from 'vitest';
import { nextRenewalDate } from './useVendorNextRenewals';

describe('nextRenewalDate', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  it('picks the earliest contract_end on or after today', () => {
    expect(
      nextRenewalDate(
        [
          { contract_end: '2026-12-01' },
          { contract_end: '2026-10-01' },
          { contract_end: '2027-01-01' }
        ],
        today
      )
    ).toBe('2026-10-01');
  });

  it('ignores contracts whose end date has already passed', () => {
    expect(nextRenewalDate([{ contract_end: '2026-01-01' }], today)).toBeNull();
  });

  it('returns null for no contracts, or contracts with no contract_end', () => {
    expect(nextRenewalDate([], today)).toBeNull();
    expect(nextRenewalDate([{ contract_end: null }], today)).toBeNull();
  });

  it("treats today's own date as upcoming", () => {
    expect(nextRenewalDate([{ contract_end: '2026-09-14' }], today)).toBe('2026-09-14');
  });
});
