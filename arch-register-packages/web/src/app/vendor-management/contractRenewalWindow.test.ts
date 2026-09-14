import { describe, expect, it } from 'vitest';
import { renewalWindow } from './contractRenewalWindow';

describe('renewalWindow', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  it('returns "none" for a contract with no end date', () => {
    expect(renewalWindow(null, today)).toBe('none');
    expect(renewalWindow(undefined, today)).toBe('none');
  });

  it('returns "overdue" for an end date before today', () => {
    expect(renewalWindow('2026-09-13', today)).toBe('overdue');
  });

  it('treats today itself as "next30"', () => {
    expect(renewalWindow('2026-09-14', today)).toBe('next30');
  });

  it('returns "next30" for an end date within 30 days', () => {
    expect(renewalWindow('2026-10-10', today)).toBe('next30');
  });

  it('returns "next90" for an end date between 31 and 90 days out', () => {
    expect(renewalWindow('2026-11-15', today)).toBe('next90');
  });

  it('returns "next365" for an end date between 91 and 365 days out', () => {
    expect(renewalWindow('2027-06-01', today)).toBe('next365');
  });

  it('returns "later" for an end date beyond 12 months', () => {
    expect(renewalWindow('2028-01-01', today)).toBe('later');
  });
});
