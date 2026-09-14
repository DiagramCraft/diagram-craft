import { describe, expect, it } from 'vitest';
import { computeTechnologyEolExposure } from './technologyEolExposure';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('computeTechnologyEolExposure', () => {
  it('returns nulls when neither eolDate nor securitySupportUntil is set', () => {
    expect(
      computeTechnologyEolExposure({ eolDate: null, securitySupportUntil: null }, NOW)
    ).toEqual({ effectiveDate: null, daysUntilEol: null, band: null });
  });

  it('falls back to securitySupportUntil when eolDate is unset', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: null, securitySupportUntil: '2026-02-01T00:00:00.000Z' },
      NOW
    );
    expect(result.effectiveDate).toBe('2026-02-01T00:00:00.000Z');
    expect(result.band).toBe('within6Months');
  });

  it('prefers eolDate over securitySupportUntil when both are set', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: '2027-06-01T00:00:00.000Z', securitySupportUntil: '2026-02-01T00:00:00.000Z' },
      NOW
    );
    expect(result.effectiveDate).toBe('2027-06-01T00:00:00.000Z');
    expect(result.band).toBe('ok');
  });

  it('bands a date already in the past as "past"', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: '2025-01-01T00:00:00.000Z', securitySupportUntil: null },
      NOW
    );
    expect(result.daysUntilEol).toBeLessThan(0);
    expect(result.band).toBe('past');
  });

  it('bands a date within 6 months as "within6Months"', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: '2026-03-01T00:00:00.000Z', securitySupportUntil: null },
      NOW
    );
    expect(result.band).toBe('within6Months');
  });

  it('bands a date more than 6 but within 12 months as "within12Months"', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: '2026-11-01T00:00:00.000Z', securitySupportUntil: null },
      NOW
    );
    expect(result.band).toBe('within12Months');
  });

  it('bands a date more than 12 months out as "ok"', () => {
    const result = computeTechnologyEolExposure(
      { eolDate: '2028-01-01T00:00:00.000Z', securitySupportUntil: null },
      NOW
    );
    expect(result.band).toBe('ok');
  });

  it('returns nulls for an unparseable date', () => {
    expect(
      computeTechnologyEolExposure({ eolDate: 'not-a-date', securitySupportUntil: null }, NOW)
    ).toEqual({ effectiveDate: null, daysUntilEol: null, band: null });
  });
});
