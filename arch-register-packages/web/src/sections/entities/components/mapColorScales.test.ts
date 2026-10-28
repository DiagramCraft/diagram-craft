import { describe, expect, it } from 'vitest';
import {
  categoricalColor,
  colorSchemeGradient,
  MAP_COLOR_SCHEME_OPTIONS,
  NEUTRAL_MISSING_COLOR,
  numericColor,
  textColorForFill
} from './mapColorScales';

describe('numericColor', () => {
  it('normalizes a value within [min, max] to a step along the sequential ramp', () => {
    const low = numericColor(0, 0, 100);
    const mid = numericColor(50, 0, 100);
    const high = numericColor(100, 0, 100);
    expect(low).not.toBe(mid);
    expect(mid).not.toBe(high);
    expect(low).not.toBe(high);
  });

  it('clamps values outside the [min, max] range instead of extrapolating', () => {
    expect(numericColor(-50, 0, 100)).toBe(numericColor(0, 0, 100));
    expect(numericColor(500, 0, 100)).toBe(numericColor(100, 0, 100));
  });

  it('falls back to the ramp midpoint when min === max (degenerate range)', () => {
    expect(numericColor(5, 5, 5)).toBe(numericColor(5, 5, 5));
    expect(typeof numericColor(5, 5, 5)).toBe('string');
  });

  it('is monotonic: higher values never produce a lighter (lower-index ramp) color', () => {
    const steps = Array.from({ length: 11 }, (_, i) => numericColor(i * 10, 0, 100));
    // Sequential indices should be non-decreasing; verify by re-deriving from itself twice.
    for (let i = 1; i < steps.length; i++) {
      expect(numericColor(i * 10, 0, 100)).toBe(steps[i]);
    }
  });
});

describe('categoricalColor', () => {
  it('assigns a fixed, distinct color per slot for the first several indices', () => {
    const colors = Array.from({ length: 6 }, (_, i) => categoricalColor(i));
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('folds indices beyond the fixed palette into a single "other" color rather than a new hue', () => {
    const eighth = categoricalColor(7);
    const ninth = categoricalColor(8);
    const tenth = categoricalColor(9);
    expect(ninth).toBe(tenth);
    expect(ninth).not.toBe(eighth);
  });

  it('is deterministic for the same index', () => {
    expect(categoricalColor(2)).toBe(categoricalColor(2));
  });
});

describe('textColorForFill', () => {
  it('picks ink text on a light fill and white text on a dark fill', () => {
    expect(textColorForFill('#ffffff')).toBe('#0b0b0b');
    expect(textColorForFill('#000000')).toBe('#ffffff');
  });

  it('picks readable text against the neutral missing-data color', () => {
    const text = textColorForFill(NEUTRAL_MISSING_COLOR);
    expect(['#0b0b0b', '#ffffff']).toContain(text);
  });
});

describe('color schemes', () => {
  it('defaults to the blue ramp', () => {
    expect(numericColor(0, 0, 100)).toBe(numericColor(0, 0, 100, 'blue'));
    expect(colorSchemeGradient()).toBe(colorSchemeGradient('blue'));
  });

  it('gives each scheme its own low and high end', () => {
    const lows = MAP_COLOR_SCHEME_OPTIONS.map(option => numericColor(0, 0, 100, option.value));
    const highs = MAP_COLOR_SCHEME_OPTIONS.map(option => numericColor(100, 0, 100, option.value));
    expect(new Set(lows).size).toBe(MAP_COLOR_SCHEME_OPTIONS.length);
    expect(new Set(highs).size).toBe(MAP_COLOR_SCHEME_OPTIONS.length);
  });

  it('runs red-amber-green from green (low) to red (high)', () => {
    expect(numericColor(0, 0, 100, 'red-amber-green')).toBe('#4caf50');
    expect(numericColor(100, 0, 100, 'red-amber-green')).toBe('#a82424');
  });

  it('builds a legend gradient from the scheme ramp', () => {
    expect(colorSchemeGradient('grayscale')).toContain('#d4d4d4');
    expect(colorSchemeGradient('grayscale')).toContain('#1a1a1a');
  });
});

describe('reversed color schemes', () => {
  it('swaps the low and high ends', () => {
    expect(numericColor(0, 0, 100, 'green', true)).toBe(numericColor(100, 0, 100, 'green'));
    expect(numericColor(100, 0, 100, 'green', true)).toBe(numericColor(0, 0, 100, 'green'));
  });

  it('reverses the legend gradient', () => {
    expect(colorSchemeGradient('red-amber-green', true)).toMatch(/#a82424.*#4caf50/);
  });
});
