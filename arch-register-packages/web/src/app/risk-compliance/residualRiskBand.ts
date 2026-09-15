/**
 * Bands `Risk.residual_risk_score` (a derived field on the schema, `likelihood ×
 * effectiveness-adjusted impact`, ranging 0-25 — see `schemaTemplates.ts`'s `risk-compliance`
 * template) into a Low/Medium/High/Critical severity, using the standard 5×5 risk-matrix
 * heat-map bands. Mirrors `../vendor-management/vendorRisk.ts`'s band machinery.
 */

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

/** Ordered ascending thresholds on the 0-25 `residual_risk_score` scale — the band a score falls
 *  into is the last one whose `min` it meets or exceeds. */
export const RESIDUAL_RISK_BANDS: { band: RiskBand; min: number }[] = [
  { band: 'low', min: -Infinity },
  { band: 'medium', min: 5 },
  { band: 'high', min: 10 },
  { band: 'critical', min: 15 }
];

export const RESIDUAL_RISK_BAND_COLOR: Record<RiskBand, string> = {
  low: 'var(--cmp-fg-success, #22c55e)',
  medium: 'var(--cmp-fg-dim, #9ca3af)',
  high: 'var(--cmp-fg-warning, #eab308)',
  critical: 'var(--cmp-fg-danger, #ef4444)'
};

export const RESIDUAL_RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

export const residualRiskBand = (score: number | null): RiskBand | null => {
  if (score == null) return null;
  let result: RiskBand = 'low';
  for (const { band, min } of RESIDUAL_RISK_BANDS) {
    if (score >= min) result = band;
  }
  return result;
};
