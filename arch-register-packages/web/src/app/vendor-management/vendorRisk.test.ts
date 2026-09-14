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

  it('defaults a missing criticality to neutral (3, no lift)', () => {
    const withCriticality = computeVendorRisk(BASE);
    const withoutCriticality = computeVendorRisk({ ...BASE, criticality: null });
    expect(withoutCriticality).toEqual(withCriticality);
  });

  it('at criticality 3 (no lift), vmRisk equals the weighted average on its native 1-5 scale', () => {
    // All-equal dimensions at value v, weights summing to 1, so the weighted average is v itself.
    const result = computeVendorRisk(BASE);
    expect(result.vmRisk).toBe(3);
    expect(result.vmRiskBand).toBe('elevated');
  });

  it('scores the lowest risk (all 1s, criticality 1) at the clamped minimum, banded low', () => {
    const result = computeVendorRisk({
      security_risk: 1,
      concentration_risk: 1,
      financial_risk: 1,
      compliance_risk: 1,
      criticality: 1
    });
    // Base score is 1 (bottom of the 1-5 scale); the criticality-1 lift (x0.88) would push it
    // below 1, so this also exercises the clamp.
    expect(result.vmRisk).toBe(1);
    expect(result.vmRiskBand).toBe('low');
  });

  it('scores the highest risk (all 5s, criticality 5) at the clamped maximum, banded high', () => {
    const result = computeVendorRisk({
      security_risk: 5,
      concentration_risk: 5,
      financial_risk: 5,
      compliance_risk: 5,
      criticality: 5
    });
    // Base score is 5 (top of the 1-5 scale); the criticality-5 lift (x1.12) would push it past
    // 5, so this also exercises the clamp.
    expect(result.vmRisk).toBe(5);
    expect(result.vmRiskBand).toBe('high');
  });

  it('lifts the same underlying risk profile higher as criticality increases', () => {
    const low = computeVendorRisk({ ...BASE, criticality: 1 });
    const high = computeVendorRisk({ ...BASE, criticality: 5 });
    expect(high.vmRisk).toBeGreaterThan(low.vmRisk!);
    expect(low.vmRiskBand).toBe('moderate');
    expect(high.vmRiskBand).toBe('elevated');
  });

  it('bands each threshold boundary correctly', () => {
    // Criticality 3 has no lift (x1.0), so an all-equal risk profile at value v scores exactly v
    // on the native 1-5 scale, letting us hit each band boundary precisely by choosing v.
    const at = (v: number) =>
      computeVendorRisk({
        security_risk: v,
        concentration_risk: v,
        financial_risk: v,
        compliance_risk: v,
        criticality: 3
      });

    expect(at(1).vmRiskBand).toBe('low');
    expect(at(1.99).vmRiskBand).toBe('low');

    // 2.0 is the low/moderate boundary (moderate is inclusive of its minimum).
    expect(at(2.0).vmRiskBand).toBe('moderate');
    expect(at(2.69).vmRiskBand).toBe('moderate');

    // 2.7 is the moderate/elevated boundary.
    expect(at(2.7).vmRiskBand).toBe('elevated');
    expect(at(3.39).vmRiskBand).toBe('elevated');

    // 3.4 is the elevated/high boundary.
    expect(at(3.4).vmRiskBand).toBe('high');
    expect(at(5).vmRiskBand).toBe('high');
  });
});
