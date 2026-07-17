// Sequential single-hue (blue) ramp, light -> dark, from the validated default data-viz
// palette. Used to color boxes by a numeric (or numeric-proxy, e.g. lifecycle sort order)
// metric value, normalized across the currently visible boxes. Trimmed to start at step 250
// rather than the ramp's lightest step (100) - each box fill spans the whole cell rather than
// a thin mark, so the near-surface end needs its own 2:1 contrast floor rather than relying on
// a background behind it (validated via the palette skill's --ordinal check).
const SEQUENTIAL_STEPS = [
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b'
];

// Fixed-order categorical palette (validated for CVD/normal-vision separation). Assigned by
// enum-option index, never cycled or reassigned when the visible option set changes - a 9th+
// option folds into CATEGORICAL_OTHER rather than generating a new hue.
const CATEGORICAL_PALETTE = [
  '#2a78d6', // blue
  '#008300', // green
  '#e87ba4', // magenta
  '#eda100', // yellow
  '#1baf7a', // aqua
  '#eb6834', // orange
  '#4a3aa7', // violet
  '#e34948' // red
];
const CATEGORICAL_OTHER = '#898781';

/** Fill color for a box with no matching/populated data. */
export const NEUTRAL_MISSING_COLOR = '#c3c2b7';

/**
 * Sequential fill color for a numeric value normalized against [min, max]. Falls back to the
 * ramp's midpoint when min === max (a single-valued or otherwise degenerate range).
 */
export const numericColor = (value: number, min: number, max: number): string => {
  if (min === max) return SEQUENTIAL_STEPS[Math.floor(SEQUENTIAL_STEPS.length / 2)]!;
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = Math.round(t * (SEQUENTIAL_STEPS.length - 1));
  return SEQUENTIAL_STEPS[index]!;
};

/** Fixed-order categorical color for the option at `index` in its enum's option list. */
export const categoricalColor = (index: number): string =>
  index < CATEGORICAL_PALETTE.length ? CATEGORICAL_PALETTE[index]! : CATEGORICAL_OTHER;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * White or ink text color for a label set inside a colored fill, picked by the fill's
 * luminance so it always clears contrast (the one place text may sit directly on a data
 * color, per the data-viz method's map-tile exception).
 */
export const textColorForFill = (hex: string): string =>
  relativeLuminance(hex) > 0.5 ? '#0b0b0b' : '#ffffff';
