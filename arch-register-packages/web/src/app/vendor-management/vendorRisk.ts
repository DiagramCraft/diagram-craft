/**
 * Composite vendor risk score, computed entirely from one Vendor entity's own scalar fields
 * (`security_risk`/`concentration_risk`/`financial_risk`/`compliance_risk`/`criticality`, each
 * 1-5 per `schemaTemplates.ts`) — no metric-engine roll-up needed, since risk isn't aggregated
 * over a subtree or relation, just computed per-vendor.
 *
 * Formula, bands, and tones mirror the Claude Design reference's `vendor-data.jsx`
 * (`vmRisk`/`vmRiskBand`/`VM_RISK_TONE`) exactly — a weighted average of the four risk
 * dimensions on their native 1-5 scale (not rescaled to 0-100), lifted linearly by criticality,
 * banded Low/Moderate/Elevated/High. Everything tunable lives in the exported constants/weights
 * below so retuning against a future design revision is a one-file change.
 */

/** Weights for the four risk dimensions, must sum to 1. */
export const VENDOR_RISK_WEIGHTS = {
  security: 0.34,
  concentration: 0.28,
  financial: 0.22,
  compliance: 0.16
} as const;

/**
 * Linear multiplicative lift applied to the weighted base score, centred on criticality 3 (no
 * lift) — 6% per point of criticality above/below 3, so a criticality-5 vendor's score is lifted
 * 12% above its raw weighted average, and a criticality-1 vendor's is reduced 12%.
 */
export const criticalityLift = (criticality: number): number => 1 + (criticality - 3) * 0.06;

export type VendorRiskBand = 'low' | 'moderate' | 'elevated' | 'high';

/** Ordered `vmRisk` (1-5) band thresholds, ascending — the band a score falls into is the last
 *  one whose `min` it meets or exceeds. */
export const VENDOR_RISK_BANDS: { band: VendorRiskBand; min: number }[] = [
  { band: 'low', min: -Infinity },
  { band: 'moderate', min: 2.0 },
  { band: 'elevated', min: 2.7 },
  { band: 'high', min: 3.4 }
];

/** Shared band → color mapping, used by the vendor drawer, Vendors table, and Risk section
 *  (chips and the `RiskMatrix`'s per-column tint) — red/amber/gray/green, gray rather than an
 *  accent color for 'moderate' so it doesn't read as more alarming than 'low'. */
export const VENDOR_RISK_BAND_COLOR: Record<VendorRiskBand, string> = {
  low: 'var(--cmp-fg-success, #22c55e)',
  moderate: 'var(--cmp-fg-dim, #9ca3af)',
  elevated: 'var(--cmp-fg-warning, #eab308)',
  high: 'var(--cmp-fg-danger, #ef4444)'
};

export const VENDOR_RISK_BAND_LABEL: Record<VendorRiskBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High'
};

export type VendorRiskInput = {
  security_risk: number | null;
  concentration_risk: number | null;
  financial_risk: number | null;
  compliance_risk: number | null;
  criticality: number | null;
};

export type VendorRiskResult = {
  /** 1-5, matching the native scale of the four risk dimensions — not rescaled to 0-100. */
  vmRisk: number | null;
  vmRiskBand: VendorRiskBand | null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const bandFor = (vmRisk: number): VendorRiskBand => {
  let result: VendorRiskBand = 'low';
  for (const { band, min } of VENDOR_RISK_BANDS) {
    if (vmRisk >= min) result = band;
  }
  return result;
};

/**
 * Weighted average of the 4 risk dimensions (1-5 scale) × the criticality lift, clamped to
 * [1, 5], then banded.
 *
 * A missing risk dimension returns `{ vmRisk: null, vmRiskBand: null }` rather than guessing at
 * an even-weight average over the present fields — a partially-scored vendor shouldn't imply a
 * false level of confidence. A missing `criticality` defaults to 3 (neutral, no lift): the schema
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

  const base =
    security_risk * VENDOR_RISK_WEIGHTS.security +
    concentration_risk * VENDOR_RISK_WEIGHTS.concentration +
    financial_risk * VENDOR_RISK_WEIGHTS.financial +
    compliance_risk * VENDOR_RISK_WEIGHTS.compliance;

  const lifted = base * criticalityLift(input.criticality ?? 3);

  // Rounded to 2 decimal places before clamping/banding to avoid floating-point noise nudging a
  // score across a band boundary.
  const vmRisk = clamp(Math.round(lifted * 100) / 100, 1, 5);
  return { vmRisk, vmRiskBand: bandFor(vmRisk) };
};
