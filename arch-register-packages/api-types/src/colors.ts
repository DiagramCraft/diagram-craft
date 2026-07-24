// Named OKLCH color palette for arch-register.
// These are dark-mode literal values — use these instead of CSS variable strings
// in data, seed data, and anywhere colors are stored or compared programmatically.

export const AR_COLOR_GREEN = 'oklch(0.62 0.13 145)';
export const AR_COLOR_BLUE = 'oklch(0.66 0.16 258)';
export const AR_COLOR_ORANGE = 'oklch(0.66 0.14 35)';
export const AR_COLOR_PURPLE = 'oklch(0.62 0.14 295)';
export const AR_COLOR_YELLOW = 'oklch(0.66 0.14 80)';
export const AR_COLOR_RED = 'oklch(0.63 0.22 25)';
export const AR_COLOR_PINK = 'oklch(0.65 0.15 340)';
export const AR_COLOR_CYAN = 'oklch(0.65 0.12 170)';
export const AR_COLOR_TEAL = 'oklch(0.65 0.14 200)';
export const AR_COLOR_AMBER = 'oklch(0.70 0.14 55)';
export const AR_COLOR_GREY = 'oklch(0.51 0 0)';

// Ordered palette for the schema/entity color picker.
export const SCHEMA_COLORS: string[] = [
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED,
  AR_COLOR_PINK,
  AR_COLOR_CYAN,
  AR_COLOR_TEAL,
  AR_COLOR_AMBER
];

// Presets for lifecycle state color selectors.
export const LIFECYCLE_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: AR_COLOR_GREEN, label: 'Green' },
  { value: AR_COLOR_BLUE, label: 'Blue' },
  { value: AR_COLOR_YELLOW, label: 'Yellow' },
  { value: AR_COLOR_RED, label: 'Red' },
  { value: AR_COLOR_GREY, label: 'Grey' }
];
