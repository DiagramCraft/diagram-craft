import { describe, expect, it } from 'vitest';
import type { ColourBand } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { overlayColor, overlayLegend, overlayTone, overlayValue } from './capabilityMapOverlays';

const maturityBands: ColourBand[] = [
  { max: 2.5, tone: 'bad' },
  { max: 3.5, tone: 'warn' },
  { max: null, tone: 'good' }
];

const maturityOverlay = { bands: maturityBands, format: 'decimal1' as const };
const investmentOverlay = {
  bands: [
    { max: 200_000, tone: 'good' },
    { max: 600_000, tone: 'warn' },
    { max: null, tone: 'bad' }
  ] as ColourBand[],
  format: 'currency' as const
};

describe('capabilityMapOverlays', () => {
  it('bands a value low-to-high through its upper bounds', () => {
    expect(overlayTone(maturityOverlay, 1.5)).toBe('bad');
    expect(overlayTone(maturityOverlay, 3)).toBe('warn');
    expect(overlayTone(maturityOverlay, 4.2)).toBe('good');
  });

  it('returns null tone / undefined colour / null value for missing data', () => {
    expect(overlayTone(maturityOverlay, null)).toBeNull();
    expect(overlayColor(maturityOverlay, null)).toBeUndefined();
    expect(overlayValue(maturityOverlay, null)).toBeNull();
  });

  it('formats the tile value per the overlay format', () => {
    expect(overlayValue(maturityOverlay, 3.25)).toBe('3.3');
    expect(overlayValue(investmentOverlay, 540_000, 'USD')).toMatch(/540|541/);
  });

  it('builds a best-to-worst legend', () => {
    expect(overlayLegend(maturityOverlay).map(entry => entry.color)).toEqual([
      'var(--green)',
      'var(--warning-fg)',
      'var(--error-fg, #e05252)'
    ]);
  });
});
