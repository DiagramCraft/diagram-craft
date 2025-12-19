import { describe, test, expect } from 'vitest';
import { parseCSSColor } from './color';

describe('parseCSSColor', () => {
  describe('valid color strings', () => {
    test('parses color with RGB values only', () => {
      const result = parseCSSColor('color(srgb 1 0.8 0.8)');
      expect(result).toEqual({ r: 1, g: 0.8, b: 0.8, alpha: 1 });
    });

    test('parses color with RGB and alpha values', () => {
      const result = parseCSSColor('color(srgb 1 0.8 0.8 / 0.2)');
      expect(result).toEqual({ r: 1, g: 0.8, b: 0.8, alpha: 0.2 });
    });

    test('parses color with zero values', () => {
      const result = parseCSSColor('color(srgb 0 0 0)');
      expect(result).toEqual({ r: 0, g: 0, b: 0, alpha: 1 });
    });

    test('parses color with all values at 1', () => {
      const result = parseCSSColor('color(srgb 1 1 1 / 1)');
      expect(result).toEqual({ r: 1, g: 1, b: 1, alpha: 1 });
    });

    test('parses color with decimal values', () => {
      const result = parseCSSColor('color(srgb 0.5 0.25 0.75 / 0.5)');
      expect(result).toEqual({ r: 0.5, g: 0.25, b: 0.75, alpha: 0.5 });
    });

    test('handles extra whitespace', () => {
      const result = parseCSSColor('  color(srgb   1   0.8   0.8  /  0.2  )  ');
      expect(result).toEqual({ r: 1, g: 0.8, b: 0.8, alpha: 0.2 });
    });

    test('parses color with alpha 0', () => {
      const result = parseCSSColor('color(srgb 0.5 0.5 0.5 / 0)');
      expect(result).toEqual({ r: 0.5, g: 0.5, b: 0.5, alpha: 0 });
    });
  });

  describe('invalid color strings', () => {
    test('returns undefined for invalid format', () => {
      expect(parseCSSColor('rgb(255, 128, 128)')).toBeUndefined();
    });

    test('returns undefined for wrong color space', () => {
      expect(parseCSSColor('color(display-p3 1 0.8 0.8)')).toBeUndefined();
    });

    test('returns undefined for missing values', () => {
      expect(parseCSSColor('color(srgb 1 0.8)')).toBeUndefined();
    });

    test('returns undefined for too many values', () => {
      expect(parseCSSColor('color(srgb 1 0.8 0.8 0.2 0.1)')).toBeUndefined();
    });

    test('parses values above 1', () => {
      expect(parseCSSColor('color(srgb 1.5 0.8 0.8)')).toEqual({ r: 1.5, g: 0.8, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 1.1 0.8)')).toEqual({ r: 1, g: 1.1, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 2)')).toEqual({ r: 1, g: 0.8, b: 2, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 0.8 / 1.5)')).toEqual({ r: 1, g: 0.8, b: 0.8, alpha: 1.5 });
    });

    test('parses negative values', () => {
      expect(parseCSSColor('color(srgb -0.1 0.8 0.8)')).toEqual({ r: -0.1, g: 0.8, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 -0.5 0.8)')).toEqual({ r: 1, g: -0.5, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 -1)')).toEqual({ r: 1, g: 0.8, b: -1, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 0.8 / -0.2)')).toEqual({ r: 1, g: 0.8, b: 0.8, alpha: -0.2 });
    });

    test('returns undefined for non-numeric values', () => {
      expect(parseCSSColor('color(srgb a b c)')).toBeUndefined();
      expect(parseCSSColor('color(srgb 1 0.8 red)')).toBeUndefined();
    });

    test('returns undefined for empty string', () => {
      expect(parseCSSColor('')).toBeUndefined();
    });

    test('returns undefined for malformed syntax', () => {
      expect(parseCSSColor('color srgb 1 0.8 0.8')).toBeUndefined();
      expect(parseCSSColor('color(srgb 1 0.8 0.8')).toBeUndefined();
      expect(parseCSSColor('color(srgb 1 0.8 0.8))')).toBeUndefined();
    });
  });
});
