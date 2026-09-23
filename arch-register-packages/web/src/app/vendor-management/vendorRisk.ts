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

export const vendorRiskBandFor = (risk: number | null | undefined): VendorRiskBand | null => {
  if (typeof risk !== 'number' || !Number.isFinite(risk)) return null;
  let result: VendorRiskBand = 'low';
  for (const { band, min } of VENDOR_RISK_BANDS) {
    if (risk >= min) result = band;
  }
  return result;
};
