import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_MAP_OVERLAYS,
  overlayBand,
  overlayColor,
  overlayValue
} from './capabilityMapOverlays';
import type { CapabilityTableRollup } from './useCapabilityRollups';

const rollup = (over: Partial<CapabilityTableRollup> = {}): CapabilityTableRollup => ({
  avgMaturity: null,
  avgMaturityTarget: null,
  avgGap: null,
  avgRisk: null,
  sumAnnualInvestment: null,
  investmentCurrencyCode: null,
  appsCount: null,
  ...over
});

describe('capabilityMapOverlays', () => {
  it('exposes None plus the five roll-up dimensions', () => {
    expect(CAPABILITY_MAP_OVERLAYS.map(o => o.id)).toEqual([
      'none',
      'maturity',
      'gap',
      'investment',
      'risk',
      'coverage'
    ]);
  });

  it('bands maturity high-is-good', () => {
    expect(overlayBand('maturity', rollup({ avgMaturity: 4.2 }))).toBe(0);
    expect(overlayBand('maturity', rollup({ avgMaturity: 3 }))).toBe(1);
    expect(overlayBand('maturity', rollup({ avgMaturity: 1.5 }))).toBe(2);
  });

  it('bands gap and risk high-is-bad', () => {
    expect(overlayBand('gap', rollup({ avgGap: 0 }))).toBe(0);
    expect(overlayBand('gap', rollup({ avgGap: 2 }))).toBe(2);
    expect(overlayBand('risk', rollup({ avgRisk: 2 }))).toBe(0);
    expect(overlayBand('risk', rollup({ avgRisk: 4 }))).toBe(2);
  });

  it('bands application coverage by count', () => {
    expect(overlayBand('coverage', rollup({ appsCount: 0 }))).toBe(2);
    expect(overlayBand('coverage', rollup({ appsCount: 2 }))).toBe(1);
    expect(overlayBand('coverage', rollup({ appsCount: 5 }))).toBe(0);
  });

  it('returns null band / undefined color / null value for missing data', () => {
    expect(overlayBand('maturity', rollup())).toBeNull();
    expect(overlayColor('maturity', rollup())).toBeUndefined();
    expect(overlayValue('maturity', rollup())).toBeNull();
    expect(overlayColor('none', rollup({ avgMaturity: 4 }))).toBeUndefined();
  });

  it('formats the tile value per overlay', () => {
    expect(overlayValue('maturity', rollup({ avgMaturity: 3.25 }))).toBe('3.3');
    expect(overlayValue('gap', rollup({ avgGap: 1.2 }))).toBe('+1.2');
    expect(overlayValue('gap', rollup({ avgGap: 0 }))).toBe('—');
    expect(overlayValue('coverage', rollup({ appsCount: 3 }))).toBe('3');
    expect(overlayValue('investment', rollup({ sumAnnualInvestment: 540_000 }))).toBe('$540k');
    expect(overlayValue('investment', rollup({ sumAnnualInvestment: 1_800_000 }))).toBe('$1.8m');
  });
});
