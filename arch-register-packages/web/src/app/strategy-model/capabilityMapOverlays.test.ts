import { describe, expect, it } from 'vitest';
import type { Overlay } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { overlayColor, overlayLegend, overlayTone, overlayValue } from './capabilityMapOverlays';
import type { CapabilityTableRollup } from './useCapabilityRollups';

const rollup = (
  values: Record<string, number | null> = {},
  currency: Record<string, string | null> = {}
): CapabilityTableRollup => ({ values, currency, appsCount: null });

const maturityOverlay: Overlay = {
  id: 'maturity',
  label: 'Maturity',
  source: 'rollup',
  fieldId: 'maturity',
  direction: 'higherBetter',
  format: 'decimal1',
  bands: [
    { max: 2.5, tone: 'bad' },
    { max: 3.5, tone: 'warn' },
    { max: null, tone: 'good' }
  ]
};

const investmentOverlay: Overlay = {
  id: 'investment',
  label: 'Investment',
  source: 'rollup',
  fieldId: 'annual_investment',
  direction: 'lowerBetter',
  format: 'currency',
  bands: [
    { max: 200_000, tone: 'good' },
    { max: 600_000, tone: 'warn' },
    { max: null, tone: 'bad' }
  ]
};

describe('capabilityMapOverlays', () => {
  it('bands a value low-to-high through its upper bounds', () => {
    expect(overlayTone(maturityOverlay, rollup({ maturity: 1.5 }))).toBe('bad');
    expect(overlayTone(maturityOverlay, rollup({ maturity: 3 }))).toBe('warn');
    expect(overlayTone(maturityOverlay, rollup({ maturity: 4.2 }))).toBe('good');
  });

  it('returns null tone / undefined colour / dash value for missing data', () => {
    expect(overlayTone(maturityOverlay, rollup())).toBeNull();
    expect(overlayColor(maturityOverlay, rollup())).toBeUndefined();
    expect(overlayValue(maturityOverlay, rollup())).toBeNull();
  });

  it('formats the tile value per the overlay format', () => {
    expect(overlayValue(maturityOverlay, rollup({ maturity: 3.25 }))).toBe('3.3');
    expect(
      overlayValue(investmentOverlay, rollup({ annual_investment: 540_000 }))
    ).toMatch(/540|541/);
  });

  it('builds a best-to-worst legend', () => {
    expect(overlayLegend(maturityOverlay).map(entry => entry.color)).toEqual([
      'var(--green)',
      'var(--warning-fg)',
      'var(--error-fg, #e05252)'
    ]);
  });
});
