/**
 * Banding for how urgent a Technology Release's end-of-life is, given `eol_date` (falling back to
 * `security_support_until` when `eol_date` isn't set — a release past its security-support window
 * but with no recorded EOL date yet is still an exposure worth surfacing). Used by the Risk
 * section's technology EOL exposure table (`useVendorTechnologyExposure.ts`), mirroring
 * `vendorRisk.ts`'s tunable-constants-plus-pure-function shape.
 */

/** Ordered band thresholds, in days until the effective EOL date — the first band whose `max`
 *  the day count is at or under wins. A negative day count (already past EOL) falls into `past`. */
export const TECHNOLOGY_EOL_EXPOSURE_BANDS = [
  { band: 'past', max: -1 },
  { band: 'within6Months', max: 182 },
  { band: 'within12Months', max: 365 },
  { band: 'ok', max: Infinity }
] as const;

export type TechnologyEolExposureBand = (typeof TECHNOLOGY_EOL_EXPOSURE_BANDS)[number]['band'];

/** Shared band → color mapping, for the exposure table's chip — mirrors
 *  `vendorRisk.ts`'s `VENDOR_RISK_BAND_COLOR`. */
export const TECHNOLOGY_EOL_EXPOSURE_BAND_COLOR: Record<TechnologyEolExposureBand, string> = {
  past: 'var(--cmp-fg-danger, #ef4444)',
  within6Months: 'var(--cmp-fg-danger, #ef4444)',
  within12Months: 'var(--cmp-fg-warning, #eab308)',
  ok: 'var(--cmp-fg-success, #22c55e)'
};

export const TECHNOLOGY_EOL_EXPOSURE_BAND_LABEL: Record<TechnologyEolExposureBand, string> = {
  past: 'Past EOL',
  within6Months: 'EOL within 6 months',
  within12Months: 'EOL within 12 months',
  ok: 'OK'
};

export type TechnologyEolExposureInput = {
  eolDate: string | null;
  securitySupportUntil: string | null;
};

export type TechnologyEolExposureResult = {
  /** The date actually used to band this exposure — `eolDate`, or `securitySupportUntil` when
   *  `eolDate` isn't set. */
  effectiveDate: string | null;
  daysUntilEol: number | null;
  band: TechnologyEolExposureBand | null;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

const bandFor = (daysUntilEol: number): TechnologyEolExposureBand =>
  TECHNOLOGY_EOL_EXPOSURE_BANDS.find(({ max }) => daysUntilEol <= max)!.band;

/**
 * Bands a Technology Release's end-of-life exposure relative to `now`. Returns nulls when neither
 * `eol_date` nor `security_support_until` is set — an unscored release shouldn't imply a false
 * "OK", because a partially-scored vendor should not imply a false level of confidence.
 */
export const computeTechnologyEolExposure = (
  input: TechnologyEolExposureInput,
  now: Date = new Date()
): TechnologyEolExposureResult => {
  const effectiveDate = input.eolDate ?? input.securitySupportUntil;
  if (!effectiveDate) return { effectiveDate: null, daysUntilEol: null, band: null };

  const parsed = new Date(effectiveDate);
  if (Number.isNaN(parsed.getTime()))
    return { effectiveDate: null, daysUntilEol: null, band: null };

  const daysUntilEol = daysBetween(now, parsed);
  return { effectiveDate, daysUntilEol, band: bandFor(daysUntilEol) };
};
