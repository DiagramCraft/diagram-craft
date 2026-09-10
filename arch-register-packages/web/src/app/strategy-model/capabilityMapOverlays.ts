import type {
  BandTone,
  ColourBand,
  NumberFormat
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { formatStrategyValue } from './strategyFormat';

/** The overlay shape these helpers need — the colour-band scale plus a value format. */
type BandedOverlay = { bands: ColourBand[]; format: NumberFormat };

/**
 * The Capability map's toolbar overlays, driven by `StrategyModelViewConfig.overlays` (#3203).
 * Each overlay is fed one already-resolved number for a capability — either the subtree roll-up
 * of `overlay.fieldId` (`source: 'rollup'`) or the capability's own field value
 * (`source: 'field'`), whichever the overlay selects — and bands it into a heat colour. `'none'`
 * is synthesised by the screen, not stored.
 */

// The app's token set carries only three severity colours — same convention as
// `CapabilityMaturityBar.tsx`'s `heatColor`.
export const BAND_TONE_COLORS: Record<BandTone, string> = {
  good: 'var(--green)',
  warn: 'var(--warning-fg)',
  bad: 'var(--error-fg, #e05252)'
};

/**
 * The heat tone for `value` under `overlay`, or `null` when there is no value.
 * Bands are evaluated low-to-high: each carries an upper bound `max` (`null` = catch-all top band).
 */
export const overlayTone = (overlay: BandedOverlay, value: number | null): BandTone | null => {
  if (value == null) return null;
  for (const band of overlay.bands) {
    if (band.max == null || value <= band.max) return band.tone;
  }
  return overlay.bands.at(-1)?.tone ?? null;
};

/** The `--heat` colour for `value` under `overlay`, or `undefined` when there is no value. */
export const overlayColor = (overlay: BandedOverlay, value: number | null): string | undefined => {
  const tone = overlayTone(overlay, value);
  return tone == null ? undefined : BAND_TONE_COLORS[tone];
};

/** The value shown on the tile under `overlay`, or `null` when there is no value. */
export const overlayValue = (
  overlay: BandedOverlay,
  value: number | null,
  currency?: string | null
): string | null => {
  if (value == null) return null;
  return formatStrategyValue(value, overlay.format, currency);
};

/** Toolbar-legend swatches for an overlay, best-to-worst by tone priority. */
export const overlayLegend = (overlay: BandedOverlay): { label: string; color: string }[] => {
  const seen = new Set<BandTone>();
  const bands: { label: string; tone: BandTone }[] = [];
  overlay.bands.forEach((band, index) => {
    if (seen.has(band.tone)) return;
    seen.add(band.tone);
    const prev = overlay.bands[index - 1]?.max;
    const label =
      band.max == null
        ? prev == null
          ? band.tone
          : `> ${prev}`
        : prev == null
          ? `≤ ${band.max}`
          : `${prev}–${band.max}`;
    bands.push({ label, tone: band.tone });
  });
  const order: BandTone[] = ['good', 'warn', 'bad'];
  return bands
    .sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))
    .map(band => ({ label: band.label, color: BAND_TONE_COLORS[band.tone] }));
};
