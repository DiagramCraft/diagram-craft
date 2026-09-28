import type { BandTone, ColourBand } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';

export type ToneOrNeutral = BandTone | 'neutral';

// The app's token set carries only three severity colours, plus a dim neutral for "no data".
export const BAND_TONE_COLORS: Record<ToneOrNeutral, string> = {
  good: 'var(--green)',
  warn: 'var(--warning-fg)',
  bad: 'var(--error-fg, #e05252)',
  neutral: 'var(--base-fg-more-dim)'
};

/**
 * The tone for `value`, evaluating bands low-to-high. Each band carries an upper bound `max`
 * (`null` = catch-all top band); the bound is inclusive unless `exclusive` is set.
 */
export const bandTone = (
  value: number,
  bands: ColourBand[],
  options: { exclusive?: boolean } = {}
): BandTone | null => {
  for (const band of bands) {
    if (band.max == null) return band.tone;
    if (options.exclusive ? value < band.max : value <= band.max) return band.tone;
  }
  return bands.at(-1)?.tone ?? null;
};

export const toneColor = (tone: ToneOrNeutral): string => BAND_TONE_COLORS[tone];

const HEAT_BANDS: ColourBand[] = [
  { max: 2, tone: 'bad' },
  { max: 3, tone: 'warn' },
  { max: null, tone: 'good' }
];

const RATIO_BANDS: ColourBand[] = [
  { max: 0.5, tone: 'bad' },
  { max: 1, tone: 'warn' },
  { max: null, tone: 'good' }
];

/** Colour for a 1–5 style score, banded on its rounded value: <=2 red, 3 amber, >=4 green. */
export const heatColor = (score: number): string =>
  toneColor(bandTone(Math.round(score), HEAT_BANDS) ?? 'neutral');

/** Colour for an effective/total ratio: <0.5 red, <1 amber, 1 green; neutral when total is 0. */
export const ratioColor = (effective: number, total: number): string =>
  total === 0
    ? toneColor('neutral')
    : toneColor(bandTone(effective / total, RATIO_BANDS, { exclusive: true }) ?? 'neutral');
