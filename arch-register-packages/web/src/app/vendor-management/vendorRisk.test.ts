import { describe, expect, it } from 'vitest';
import { computeVendorRisk, type VendorRiskInput } from './vendorRisk';

const BASE: VendorRiskInput = {
  security_risk: 3,
  concentration_risk: 3,
  financial_risk: 3,
  compliance_risk: 3,
  criticality: 3
};

describe('computeVendorRisk', () => {
  it('returns null vmRisk/vmRiskBand when any risk dimension is missing', () => {
    expect(computeVendorRisk({ ...BASE, security_risk: null })).toEqual({
      vmRisk: null,
      vmRiskBand: null
    });
    expect(computeVendorRisk({ ...BASE, concentration_risk: null })).toEqual({
      vmRisk: null,
      vmRiskBand: null
    });
    expect(computeVendorRisk({ ...BASE, financial_risk: null })).toEqual({
      vmRisk: null,
      vmRiskBand: null
    });
    expect(computeVendorRisk({ ...BASE, compliance_risk: null })).toEqual({
      vmRisk: null,
      vmRiskBand: null
    });
  });

  it('defaults a missing criticality to neutral (3)', () => {
    const withCriticality = computeVendorRisk(BASE);
    const withoutCriticality = computeVendorRisk({ ...BASE, criticality: null });
    expect(withoutCriticality).toEqual(withCriticality);
  });

  it('scores the lowest risk (all 1s) as 0, banded low', () => {
    const result = computeVendorRisk({
      security_risk: 1,
      concentration_risk: 1,
      financial_risk: 1,
      compliance_risk: 1,
      criticality: 1
    });
    expect(result.vmRisk).toBe(0);
    expect(result.vmRiskBand).toBe('low');
  });

  it('scores the highest risk (all 5s, criticality 5) at the clamped maximum, banded critical', () => {
    const result = computeVendorRisk({
      security_risk: 5,
      concentration_risk: 5,
      financial_risk: 5,
      compliance_risk: 5,
      criticality: 5
    });
    // Base score is 100 (top of the 1-5 scale); the criticality-5 lift (x1.3) would push it past
    // 100, so this also exercises the clamp.
    expect(result.vmRisk).toBe(100);
    expect(result.vmRiskBand).toBe('critical');
  });

  it('lifts the same underlying risk profile higher as criticality increases', () => {
    const low = computeVendorRisk({ ...BASE, criticality: 1 });
    const high = computeVendorRisk({ ...BASE, criticality: 5 });
    expect(high.vmRisk).toBeGreaterThan(low.vmRisk!);
  });

  it('bands each threshold boundary correctly', () => {
    // Weighted average of all-equal dimensions at value v, criticality 1 (lift x1.0), rescales
    // to (v-1)/4*100 exactly, letting us hit each band boundary precisely by choosing v.
    const at = (v: number) =>
      computeVendorRisk({
        security_risk: v,
        concentration_risk: v,
        financial_risk: v,
        compliance_risk: v,
        criticality: 1
      });

    expect(at(1).vmRisk).toBe(0);
    expect(at(1).vmRiskBand).toBe('low');

    // v = 2.2 -> (2.2-1)/4*100 = 30 (up to floating-point error), the low/medium boundary.
    expect(at(2.2).vmRisk).toBeCloseTo(30, 5);
    // Just below/above 30 falls either side of the boundary.
    expect(at(2.19).vmRiskBand).toBe('low');
    expect(at(2.21).vmRiskBand).toBe('medium');

    // v = 3.2 -> 55, the medium/high boundary.
    expect(at(3.2).vmRisk).toBeCloseTo(55, 5);
    expect(at(3.19).vmRiskBand).toBe('medium');
    expect(at(3.21).vmRiskBand).toBe('high');

    // v = 4 -> 75, the high/critical boundary.
    expect(at(4).vmRisk).toBeCloseTo(75, 5);
    expect(at(3.99).vmRiskBand).toBe('high');
    expect(at(4.01).vmRiskBand).toBe('critical');

    expect(at(5).vmRisk).toBe(100);
    expect(at(5).vmRiskBand).toBe('critical');
  });
});
