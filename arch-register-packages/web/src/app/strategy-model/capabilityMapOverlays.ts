import type { BandTone, Overlay } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import type { CapabilityTableRollup } from './useCapabilityRollups';
import { formatStrategyValue } from './strategyFormat';

/**
 * The Capability map's toolbar overlays, driven by `StrategyModelViewConfig.overlays` (#3203).
 * Each overlay reads one roll-up value off a capability's `CapabilityTableRollup` and bands it
 * into a heat colour. `'none'` is synthesised by the screen, not stored.
 */

// The app's token set carries only three severity colours — same convention as
// `CapabilityMaturityBar.tsx`'s `heatColor`.
export const BAND_TONE_COLORS: Record<BandTone, string> = {
  good: 'var(--green)',
  warn: 'var(--warning-fg)',
  bad: 'var(--error-fg, #e05252)'
};

const overlayRawValue = (overlay: Overlay, rollup: CapabilityTableRollup): number | null =>
  rollup.values[overlay.fieldId] ?? null;

/**
 * The heat tone for a capability under `overlay`, or `null` when the roll-up has no value.
 * Bands are evaluated low-to-high: each carries an upper bound `max` (`null` = catch-all top band).
 */
export const overlayTone = (
  overlay: Overlay,
  rollup: CapabilityTableRollup
): BandTone | null => {
  const value = overlayRawValue(overlay, rollup);
  if (value == null) return null;
  for (const band of overlay.bands) {
    if (band.max == null || value <= band.max) return band.tone;
  }
  return overlay.bands.at(-1)?.tone ?? null;
};

/** The `--heat` colour for a tile under `overlay`, or `undefined` when there is no value. */
export const overlayColor = (
  overlay: Overlay,
  rollup: CapabilityTableRollup
): string | undefined => {
  const tone = overlayTone(overlay, rollup);
  return tone == null ? undefined : BAND_TONE_COLORS[tone];
};

/** The value shown on the tile under `overlay`, or `null` when there is no value. */
export const overlayValue = (
  overlay: Overlay,
  rollup: CapabilityTableRollup
): string | null => {
  const value = overlayRawValue(overlay, rollup);
  if (value == null) return null;
  return formatStrategyValue(value, overlay.format, rollup.currency[overlay.fieldId]);
};

/** Toolbar-legend swatches for an overlay, best-to-worst by tone priority. */
export const overlayLegend = (overlay: Overlay): { label: string; color: string }[] => {
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
