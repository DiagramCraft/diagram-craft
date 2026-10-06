import type { MetricConfig } from '@arch-register/api-types/metricContract';
import { BAND_TONE_COLORS, bandTone } from '../../../components/bandColor';

type Bands = NonNullable<MetricConfig['colourBands']>;
type Tone = Bands[number]['tone'];

/** The band tone for `value`, or `null` when there is no value. */
export const bandedTone = (bands: Bands, value: number | null): Tone | null =>
  value == null ? null : bandTone(value, bands);

/**
 * Box fill for `value` under `bands`: the band's severity colour as a tint, so the entity name
 * keeps the normal text colour (the severity tokens are CSS variables, not hex, so there's no
 * luminance to pick a contrasting label colour from), or `null` when there is no value.
 */
export const bandedFill = (bands: Bands, value: number | null): string | null => {
  const tone = bandedTone(bands, value);
  return tone == null ? null : `color-mix(in srgb, ${BAND_TONE_COLORS[tone]} 30%, transparent)`;
};

/** Legend swatches for `bands`, best-to-worst by tone priority, one per tone. */
export const bandedLegend = (bands: Bands): { label: string; color: string }[] => {
  const seen = new Set<Tone>();
  const entries: { label: string; tone: Tone }[] = [];
  bands.forEach((band, index) => {
    if (seen.has(band.tone)) return;
    seen.add(band.tone);
    const prev = bands[index - 1]?.max;
    const label =
      band.max == null
        ? prev == null
          ? band.tone
          : `> ${prev}`
        : prev == null
          ? `≤ ${band.max}`
          : `${prev}–${band.max}`;
    entries.push({ label, tone: band.tone });
  });
  const order: Tone[] = ['good', 'warn', 'bad'];
  return entries
    .sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))
    .map(entry => ({ label: entry.label, color: BAND_TONE_COLORS[entry.tone] }));
};
