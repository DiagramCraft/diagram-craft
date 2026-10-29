import { toneColor, type ToneOrNeutral } from '../../components/bandColor';

/** Presentation helpers for the derived Vendor `risk` rating. */

export type VendorRiskBand = 'low' | 'moderate' | 'elevated' | 'high';

/** Ordered derived `risk` (1-5) band thresholds, ascending — the band a score falls into is the last
 *  one whose `min` it meets or exceeds. */
export const VENDOR_RISK_BANDS: { band: VendorRiskBand; min: number }[] = [
  { band: 'low', min: -Infinity },
  { band: 'moderate', min: 2.0 },
  { band: 'elevated', min: 2.7 },
  { band: 'high', min: 3.4 }
];

/** Shared band → tone mapping, used by the vendor drawer, Vendors table, and Risk section
 *  (chips and the `RiskMatrix`'s per-column tint) — `moderate` maps to `neutral` (gray) rather
 *  than `warn` so it doesn't read as more alarming than `low`. Colors come from
 *  `../../components/bandColor.ts`'s good/neutral/warn/bad scheme. */
export const VENDOR_RISK_BAND_TONE: Record<VendorRiskBand, ToneOrNeutral> = {
  low: 'good',
  moderate: 'neutral',
  elevated: 'warn',
  high: 'bad'
};

export const VENDOR_RISK_BAND_COLOR: Record<VendorRiskBand, string> = {
  low: toneColor(VENDOR_RISK_BAND_TONE.low),
  moderate: toneColor(VENDOR_RISK_BAND_TONE.moderate),
  elevated: toneColor(VENDOR_RISK_BAND_TONE.elevated),
  high: toneColor(VENDOR_RISK_BAND_TONE.high)
};

export const VENDOR_RISK_BAND_LABEL: Record<VendorRiskBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High'
};

export const vendorRiskBandFor = (risk: number | null | undefined): VendorRiskBand | null => {
  if (typeof risk !== 'number' || !Number.isFinite(risk)) return null;
  let result: VendorRiskBand = 'low';
  for (const { band, min } of VENDOR_RISK_BANDS) {
    if (risk >= min) result = band;
  }
  return result;
};
