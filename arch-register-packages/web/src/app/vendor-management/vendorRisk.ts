/**
 * Composite vendor risk score, computed entirely from one Vendor entity's own scalar fields
 * (`security_risk`/`concentration_risk`/`financial_risk`/`compliance_risk`/`criticality`, each
 * 1-5 per `schemaTemplates.ts`) — no metric-engine roll-up needed, since risk isn't aggregated
 * over a subtree or relation, just computed per-vendor.
 *
 * PLACEHOLDER FORMULA: the design reference for this calculation (`vendor-data.jsx`, an
 * external Claude Design canvas) isn't available from this session, so the weights, criticality
 * lift, and band thresholds below are a documented assumption, not the final design. Everything
 * tunable lives in the three exported constants so retuning against the real design is a
 * one-file change.
 */

/** Weights for the four risk dimensions, must sum to 1. */
export const VENDOR_RISK_WEIGHTS = {
  security: 0.35,
  concentration: 0.2,
  financial: 0.2,
  compliance: 0.25
} as const;

/**
 * Multiplicative lift applied to the weighted base score per criticality tier (1-5) — the same
 * dimension scores matter more for a highly critical vendor, so a criticality-5 vendor's risk
 * score is lifted up to 30% above its raw weighted average.
 */
export const CRITICALITY_LIFT: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1.0,
  2: 1.05,
  3: 1.1,
  4: 1.2,
  5: 1.3
};

/** Ordered `vmRisk` (0-100) band thresholds — the first band whose `max` the score is at or
 *  under wins. */
export const VENDOR_RISK_BANDS = [
  { band: 'low', max: 30 },
  { band: 'medium', max: 55 },
  { band: 'high', max: 75 },
  { band: 'critical', max: Infinity }
] as const;

export type VendorRiskBand = (typeof VENDOR_RISK_BANDS)[number]['band'];

/** Shared band → color mapping, used by both `VendorDrawer` and `VendorVendorsScreen`. */
export const VENDOR_RISK_BAND_COLOR: Record<VendorRiskBand, string> = {
  low: 'var(--cmp-fg-success, #22c55e)',
  medium: 'var(--cmp-fg-warning, #eab308)',
  high: 'var(--cmp-fg-danger, #ef4444)',
  critical: 'var(--cmp-fg-danger, #ef4444)'
};

export type VendorRiskInput = {
  security_risk: number | null;
  concentration_risk: number | null;
  financial_risk: number | null;
  compliance_risk: number | null;
  criticality: number | null;
};

export type VendorRiskResult = {
  vmRisk: number | null;
  vmRiskBand: VendorRiskBand | null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const bandFor = (vmRisk: number): VendorRiskBand =>
  VENDOR_RISK_BANDS.find(({ max }) => vmRisk <= max)!.band;

/**
 * Weighted average of the 4 risk dimensions (1-5 scale) → rescaled to 0-100 → multiplied by the
 * criticality lift → clamped to [0, 100] → banded.
 *
 * A missing risk dimension returns `{ vmRisk: null, vmRiskBand: null }` rather than guessing at
 * an even-weight average over the present fields — a partially-scored vendor shouldn't imply a
 * false level of confidence. A missing `criticality` defaults to 3 (neutral): the schema
 * requires it, so this is only a defensive fallback, not an expected path.
 */
export const computeVendorRisk = (input: VendorRiskInput): VendorRiskResult => {
  const { security_risk, concentration_risk, financial_risk, compliance_risk } = input;
  if (
    security_risk == null ||
    concentration_risk == null ||
    financial_risk == null ||
    compliance_risk == null
  ) {
    return { vmRisk: null, vmRiskBand: null };
  }

  const weightedAverage =
    security_risk * VENDOR_RISK_WEIGHTS.security +
    concentration_risk * VENDOR_RISK_WEIGHTS.concentration +
    financial_risk * VENDOR_RISK_WEIGHTS.financial +
    compliance_risk * VENDOR_RISK_WEIGHTS.compliance;

  const baseScore = ((weightedAverage - 1) / 4) * 100;

  const criticality = clamp(Math.round(input.criticality ?? 3), 1, 5) as 1 | 2 | 3 | 4 | 5;
  const lifted = baseScore * CRITICALITY_LIFT[criticality];

  // Rounded to 2 decimal places before clamping/banding to avoid floating-point noise (e.g.
  // `0.35 + 0.2 + 0.2 + 0.25` landing a hair above 1) nudging a score across a band boundary.
  const vmRisk = clamp(Math.round(lifted * 100) / 100, 0, 100);
  return { vmRisk, vmRiskBand: bandFor(vmRisk) };
};
