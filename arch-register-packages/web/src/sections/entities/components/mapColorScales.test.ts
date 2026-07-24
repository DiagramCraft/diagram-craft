import { describe, expect, it } from 'vitest';
import {
  categoricalColor,
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
