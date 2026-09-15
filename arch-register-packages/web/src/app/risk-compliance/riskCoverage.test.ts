import { describe, expect, it } from 'vitest';
import { computeRiskCoverage } from './riskCoverage';

describe('computeRiskCoverage', () => {
  it('returns null rcCoverage/rcBand for no relations', () => {
    expect(computeRiskCoverage([])).toEqual({ rcCoverage: null, rcBand: null });
  });

  it('skips relations with a missing coverage or unrecognized effectiveness', () => {
    expect(
      computeRiskCoverage([
        { coverage: null, effectiveness: 'full' },
        { coverage: 80, effectiveness: 'unknown' }
      ])
    ).toEqual({ rcCoverage: null, rcBand: null });
  });

  it('a single full-effectiveness control at 100% coverage is fully covered', () => {
    expect(computeRiskCoverage([{ coverage: 100, effectiveness: 'full' }])).toEqual({
      rcCoverage: 100,
      rcBand: 'strong'
    });
  });

  it('a single none-effectiveness relation contributes zero, regardless of raw coverage', () => {
    expect(computeRiskCoverage([{ coverage: 100, effectiveness: 'none' }])).toEqual({
      rcCoverage: 0,
      rcBand: 'uncovered'
    });
  });

  it('a single partial-effectiveness relation at 70% coverage', () => {
    // effectiveCoverage = 70 * 0.5 = 35
    expect(computeRiskCoverage([{ coverage: 70, effectiveness: 'partial' }])).toEqual({
      rcCoverage: 35,
      rcBand: 'partial'
    });
  });

  it('combines multiple controls as independent overlapping layers, not a plain average', () => {
    // Three separate controls each with effectiveCoverage 50% combine to 1 - 0.5^3 = 87.5%,
    // well above the 50% a plain average would give.
    const relations = [
      { coverage: 100, effectiveness: 'partial' as const },
      { coverage: 100, effectiveness: 'partial' as const },
      { coverage: 100, effectiveness: 'partial' as const }
    ];
    expect(computeRiskCoverage(relations)).toEqual({ rcCoverage: 87.5, rcBand: 'strong' });
  });

  it('bands per the ascending thresholds', () => {
    expect(computeRiskCoverage([{ coverage: 50, effectiveness: 'partial' }]).rcBand).toBe(
      'partial'
    );
    expect(computeRiskCoverage([{ coverage: 90, effectiveness: 'substantial' }]).rcBand).toBe(
      'adequate'
    );
    expect(computeRiskCoverage([{ coverage: 100, effectiveness: 'full' }]).rcBand).toBe('strong');
  });
});
