import { describe, expect, it } from 'vitest';
import { bandedFill, bandedLegend, bandedTone } from './mapBandColors';

const maturityBands = [
  { max: 2.5, tone: 'bad' as const },
  { max: 3.5, tone: 'warn' as const },
  { max: null, tone: 'good' as const }
];

describe('mapBandColors', () => {
  it('bands a value low-to-high through its upper bounds', () => {
    expect(bandedTone(maturityBands, 1.5)).toBe('bad');
    expect(bandedTone(maturityBands, 3)).toBe('warn');
    expect(bandedTone(maturityBands, 4.2)).toBe('good');
  });

  it('returns null for missing data', () => {
    expect(bandedTone(maturityBands, null)).toBeNull();
    expect(bandedFill(maturityBands, null)).toBeNull();
  });

  it('tints the fill with the band colour', () => {
    expect(bandedFill(maturityBands, 1)).toContain('var(--error-fg');
  });

  it('builds a best-to-worst legend', () => {
    expect(bandedLegend(maturityBands)).toEqual([
      { label: '> 3.5', color: 'var(--green)' },
      { label: '2.5–3.5', color: 'var(--warning-fg)' },
      { label: '≤ 2.5', color: 'var(--error-fg, #e05252)' }
    ]);
  });
});
