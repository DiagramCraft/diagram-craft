import { describe, expect, it } from 'vitest';
import { vendorRiskBandFor } from './vendorRisk';

describe('vendorRiskBandFor', () => {
  it('returns null for missing or invalid derived scores', () => {
    expect(vendorRiskBandFor(null)).toBeNull();
    expect(vendorRiskBandFor(undefined)).toBeNull();
    expect(vendorRiskBandFor(Number.NaN)).toBeNull();
  });

  it('preserves the existing threshold boundaries', () => {
    expect(vendorRiskBandFor(1)).toBe('low');
    expect(vendorRiskBandFor(1.99)).toBe('low');
    expect(vendorRiskBandFor(2)).toBe('moderate');
    expect(vendorRiskBandFor(2.69)).toBe('moderate');
    expect(vendorRiskBandFor(2.7)).toBe('elevated');
    expect(vendorRiskBandFor(3.39)).toBe('elevated');
    expect(vendorRiskBandFor(3.4)).toBe('high');
    expect(vendorRiskBandFor(5)).toBe('high');
  });
});
