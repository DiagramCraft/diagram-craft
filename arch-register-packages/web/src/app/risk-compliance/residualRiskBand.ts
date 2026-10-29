import { toneColor, type ToneOrNeutral } from '../../components/bandColor';

/**
 * Bands `Risk.residual_risk_score` (a derived field on the schema, `likelihood ×
 * effectiveness-adjusted impact`, ranging 0-25 — see `schemaTemplates.ts`'s `risk-compliance`
 * template) into a Low/Medium/High/Critical severity, using the standard 5×5 risk-matrix
 * heat-map bands. Mirrors `../vendor-management/vendorRisk.ts`'s band machinery; both share
 * their colors with `../../components/bandColor.ts`'s good/neutral/warn/bad scheme.
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

/** `medium` maps to `neutral` (gray), not `warn`, so it doesn't read as more alarming than
 *  `low` — mirrors `../vendor-management/vendorRisk.ts`'s `VENDOR_RISK_BAND_TONE`. */
export const RESIDUAL_RISK_BAND_TONE: Record<RiskBand, ToneOrNeutral> = {
  low: 'good',
  medium: 'neutral',
  high: 'warn',
  critical: 'bad'
};

export const RESIDUAL_RISK_BAND_COLOR: Record<RiskBand, string> = {
  low: toneColor(RESIDUAL_RISK_BAND_TONE.low),
  medium: toneColor(RESIDUAL_RISK_BAND_TONE.medium),
  high: toneColor(RESIDUAL_RISK_BAND_TONE.high),
  critical: toneColor(RESIDUAL_RISK_BAND_TONE.critical)
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
