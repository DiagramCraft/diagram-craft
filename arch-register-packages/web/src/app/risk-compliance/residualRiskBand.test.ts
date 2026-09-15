import { describe, expect, it } from 'vitest';
import { residualRiskBand } from './residualRiskBand';

describe('residualRiskBand', () => {
  it('returns null for a null score', () => {
    expect(residualRiskBand(null)).toBeNull();
  });

  it('bands scores per the standard 5x5 heat-map thresholds', () => {
    expect(residualRiskBand(0)).toBe('low');
    expect(residualRiskBand(4)).toBe('low');
    expect(residualRiskBand(5)).toBe('medium');
    expect(residualRiskBand(9)).toBe('medium');
    expect(residualRiskBand(10)).toBe('high');
    expect(residualRiskBand(14)).toBe('high');
    expect(residualRiskBand(15)).toBe('critical');
    expect(residualRiskBand(25)).toBe('critical');
  });
});
