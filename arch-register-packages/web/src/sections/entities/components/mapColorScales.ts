export type MapColorScheme = 'blue' | 'green' | 'red' | 'red-amber-green' | 'grayscale';

export const MAP_COLOR_SCHEME_OPTIONS: Array<{ value: MapColorScheme; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'red-amber-green', label: 'Red-amber-green' },
  { value: 'grayscale', label: 'Grayscale' }
];

// Sequential ramps, low -> high, used to color boxes by a numeric (or numeric-proxy, e.g.
// lifecycle sort order) metric value, normalized across the currently visible boxes. The blue ramp
// is from the validated default data-viz palette, trimmed to start at step 250 rather than the
// ramp's lightest step (100): each box fill spans the whole cell rather than a thin mark, so the
// near-surface end needs its own 2:1 contrast floor rather than relying on a background behind it.
// The other schemes follow the same light -> dark shape; red-amber-green runs green (low) through
// amber to red (high), like the heat map's severity scale.
const COLOR_RAMPS: Record<MapColorScheme, string[]> = {
  blue: [
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
  ],
  green: [
    '#9bd8a6',
    '#7fcb8e',
    '#63be77',
    '#47ae62',
    '#2f9e52',
    '#278a47',
    '#1f763c',
    '#186232',
    '#124f28',
    '#0d3d1f'
  ],
  red: [
    '#f2a7a4',
    '#ee8c88',
    '#e9716c',
    '#e35550',
    '#d93b37',
    '#c2302d',
    '#a92724',
    '#8f201e',
    '#751917',
    '#5c1312'
  ],
  'red-amber-green': [
    '#4caf50',
    '#7cb342',
    '#aab32f',
    '#d4b21f',
    '#eda100',
    '#f08a1c',
    '#eb6834',
    '#e34948',
    '#c93434',
    '#a82424'
  ],
  grayscale: [
    '#d4d4d4',
    '#bdbdbd',
    '#a6a6a6',
    '#909090',
    '#7a7a7a',
    '#656565',
    '#515151',
    '#3d3d3d',
    '#2b2b2b',
    '#1a1a1a'
  ]
};

/** CSS gradient (low -> high) matching a scheme's ramp, for legends. */
export const colorSchemeGradient = (scheme: MapColorScheme = 'blue', reversed = false): string =>
  `linear-gradient(to right, ${(reversed ? [...COLOR_RAMPS[scheme]].reverse() : COLOR_RAMPS[scheme]).join(', ')})`;

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
export const numericColor = (
  value: number,
  min: number,
  max: number,
  scheme: MapColorScheme = 'blue',
  reversed = false
): string => {
  const ramp = COLOR_RAMPS[scheme];
  if (min === max) return ramp[Math.floor(ramp.length / 2)]!;
  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const t = reversed ? 1 - normalized : normalized;
  const index = Math.round(t * (ramp.length - 1));
  return ramp[index]!;
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
export const textColorForFill = (hex: string): string => {
  // A tinted token fill (e.g. a `color-mix(...)` band colour) has no luminance to measure; the
  // tint is light enough for the regular text colour.
  if (!hex.startsWith('#')) return 'var(--base-fg)';
  return relativeLuminance(hex) > 0.5 ? '#0b0b0b' : '#ffffff';
};
