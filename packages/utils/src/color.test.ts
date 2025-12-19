import { describe, test, expect } from 'vitest';
import { parseCSSColor, srgbToOklch, oklchToSrgb, convertColorTo, deltaE } from './color';

describe('parseCSSColor', () => {
  describe('valid color strings', () => {
    test('parses color with RGB values only', () => {
      const result = parseCSSColor('color(srgb 1 0.8 0.8)');
      expect(result).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 0.8, alpha: 1 });
    });

    test('parses color with RGB and alpha values', () => {
      const result = parseCSSColor('color(srgb 1 0.8 0.8 / 0.2)');
      expect(result).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 0.8, alpha: 0.2 });
    });

    test('parses color with zero values', () => {
      const result = parseCSSColor('color(srgb 0 0 0)');
      expect(result).toEqual({ type: 'srgb', r: 0, g: 0, b: 0, alpha: 1 });
    });

    test('parses color with all values at 1', () => {
      const result = parseCSSColor('color(srgb 1 1 1 / 1)');
      expect(result).toEqual({ type: 'srgb', r: 1, g: 1, b: 1, alpha: 1 });
    });

    test('parses color with decimal values', () => {
      const result = parseCSSColor('color(srgb 0.5 0.25 0.75 / 0.5)');
      expect(result).toEqual({ type: 'srgb', r: 0.5, g: 0.25, b: 0.75, alpha: 0.5 });
    });

    test('handles extra whitespace', () => {
      const result = parseCSSColor('  color(srgb   1   0.8   0.8  /  0.2  )  ');
      expect(result).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 0.8, alpha: 0.2 });
    });

    test('parses color with alpha 0', () => {
      const result = parseCSSColor('color(srgb 0.5 0.5 0.5 / 0)');
      expect(result).toEqual({ type: 'srgb', r: 0.5, g: 0.5, b: 0.5, alpha: 0 });
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
      expect(parseCSSColor('color(srgb 1.5 0.8 0.8)')).toEqual({ type: 'srgb', r: 1.5, g: 0.8, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 1.1 0.8)')).toEqual({ type: 'srgb', r: 1, g: 1.1, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 2)')).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 2, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 0.8 / 1.5)')).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 0.8, alpha: 1.5 });
    });

    test('parses negative values', () => {
      expect(parseCSSColor('color(srgb -0.1 0.8 0.8)')).toEqual({ type: 'srgb', r: -0.1, g: 0.8, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 -0.5 0.8)')).toEqual({ type: 'srgb', r: 1, g: -0.5, b: 0.8, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 -1)')).toEqual({ type: 'srgb', r: 1, g: 0.8, b: -1, alpha: 1 });
      expect(parseCSSColor('color(srgb 1 0.8 0.8 / -0.2)')).toEqual({ type: 'srgb', r: 1, g: 0.8, b: 0.8, alpha: -0.2 });
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

describe('srgbToOklch', () => {
  test('converts white', () => {
    const srgb = { type: 'srgb' as const, r: 1, g: 1, b: 1, alpha: 1 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(1.0, 4);
    expect(oklch.c).toBeCloseTo(0, 3);
    expect(oklch.alpha).toBe(1);
  });

  test('converts black', () => {
    const srgb = { type: 'srgb' as const, r: 0, g: 0, b: 0, alpha: 1 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(0, 4);
    expect(oklch.c).toBeCloseTo(0, 4);
    expect(oklch.alpha).toBe(1);
  });

  test('converts red', () => {
    const srgb = { type: 'srgb' as const, r: 1, g: 0, b: 0, alpha: 1 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(0.627955, 4);
    expect(oklch.c).toBeCloseTo(0.25768, 4);
    expect(oklch.h).toBeCloseTo(29.234, 1);
    expect(oklch.alpha).toBe(1);
  });

  test('converts green', () => {
    const srgb = { type: 'srgb' as const, r: 0, g: 1, b: 0, alpha: 1 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(0.86644, 4);
    expect(oklch.c).toBeCloseTo(0.29483, 4);
    expect(oklch.h).toBeCloseTo(142.495, 1);
    expect(oklch.alpha).toBe(1);
  });

  test('converts blue', () => {
    const srgb = { type: 'srgb' as const, r: 0, g: 0, b: 1, alpha: 1 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(0.45201, 4);
    expect(oklch.c).toBeCloseTo(0.31321, 3);
    expect(oklch.h).toBeCloseTo(264.052, 1);
    expect(oklch.alpha).toBe(1);
  });

  test('preserves alpha', () => {
    const srgb = { type: 'srgb' as const, r: 0.5, g: 0.5, b: 0.5, alpha: 0.5 };
    const oklch = srgbToOklch(srgb);

    expect(oklch.alpha).toBe(0.5);
  });
});

describe('oklchToSrgb', () => {
  test('converts white', () => {
    const oklch = { type: 'oklch' as const, l: 1, c: 0, h: 0, alpha: 1 };
    const srgb = oklchToSrgb(oklch);

    expect(srgb.type).toBe('srgb');
    expect(srgb.r).toBeCloseTo(1, 3);
    expect(srgb.g).toBeCloseTo(1, 3);
    expect(srgb.b).toBeCloseTo(1, 3);
    expect(srgb.alpha).toBe(1);
  });

  test('converts black', () => {
    const oklch = { type: 'oklch' as const, l: 0, c: 0, h: 0, alpha: 1 };
    const srgb = oklchToSrgb(oklch);

    expect(srgb.type).toBe('srgb');
    expect(srgb.r).toBeCloseTo(0, 4);
    expect(srgb.g).toBeCloseTo(0, 4);
    expect(srgb.b).toBeCloseTo(0, 4);
    expect(srgb.alpha).toBe(1);
  });

  test('converts red (approximately)', () => {
    const oklch = { type: 'oklch' as const, l: 0.627955, c: 0.25768, h: 29.234, alpha: 1 };
    const srgb = oklchToSrgb(oklch);

    expect(srgb.type).toBe('srgb');
    expect(srgb.r).toBeCloseTo(1, 2);
    expect(srgb.g).toBeCloseTo(0, 2);
    expect(srgb.b).toBeCloseTo(0, 2);
    expect(srgb.alpha).toBe(1);
  });

  test('preserves alpha', () => {
    const oklch = { type: 'oklch' as const, l: 0.5, c: 0.1, h: 180, alpha: 0.7 };
    const srgb = oklchToSrgb(oklch);

    expect(srgb.alpha).toBe(0.7);
  });
});

describe('round-trip conversions', () => {
  test('sRGB -> OKLCh -> sRGB preserves values', () => {
    const original = { type: 'srgb' as const, r: 0.8, g: 0.4, b: 0.6, alpha: 0.9 };
    const oklch = srgbToOklch(original);
    const result = oklchToSrgb(oklch);

    expect(result.type).toBe('srgb');
    expect(result.r).toBeCloseTo(original.r, 5);
    expect(result.g).toBeCloseTo(original.g, 5);
    expect(result.b).toBeCloseTo(original.b, 5);
    expect(result.alpha).toBe(original.alpha);
  });

  test('OKLCh -> sRGB -> OKLCh preserves values', () => {
    const original = { type: 'oklch' as const, l: 0.7, c: 0.15, h: 120, alpha: 0.8 };
    const srgb = oklchToSrgb(original);
    const result = srgbToOklch(srgb);

    expect(result.type).toBe('oklch');
    expect(result.l).toBeCloseTo(original.l, 5);
    expect(result.c).toBeCloseTo(original.c, 5);
    expect(result.h).toBeCloseTo(original.h, 1);
    expect(result.alpha).toBe(original.alpha);
  });
});

describe('convertColorTo', () => {
  test('returns same color when source and target are identical', () => {
    const srgb = { type: 'srgb' as const, r: 0.5, g: 0.6, b: 0.7, alpha: 1 };
    const result = convertColorTo(srgb, 'srgb');

    expect(result).toBe(srgb);
  });

  test('converts srgb to oklch', () => {
    const srgb = { type: 'srgb' as const, r: 1, g: 0, b: 0, alpha: 1 };
    const oklch = convertColorTo(srgb, 'oklch');

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBeCloseTo(0.627955, 4);
    expect(oklch.c).toBeCloseTo(0.25768, 4);
    expect(oklch.h).toBeCloseTo(29.234, 1);
    expect(oklch.alpha).toBe(1);
  });

  test('converts oklch to srgb', () => {
    const oklch = { type: 'oklch' as const, l: 0.627955, c: 0.25768, h: 29.234, alpha: 1 };
    const srgb = convertColorTo(oklch, 'srgb');

    expect(srgb.type).toBe('srgb');
    expect(srgb.r).toBeCloseTo(1, 2);
    expect(srgb.g).toBeCloseTo(0, 2);
    expect(srgb.b).toBeCloseTo(0, 2);
    expect(srgb.alpha).toBe(1);
  });

  test('converts srgb to rgb (linear)', () => {
    const srgb = { type: 'srgb' as const, r: 0.5, g: 0.5, b: 0.5, alpha: 1 };
    const rgb = convertColorTo(srgb, 'rgb');

    expect(rgb.type).toBe('rgb');
    expect(rgb.r).toBeCloseTo(0.2140, 4);
    expect(rgb.g).toBeCloseTo(0.2140, 4);
    expect(rgb.b).toBeCloseTo(0.2140, 4);
    expect(rgb.alpha).toBe(1);
  });

  test('converts rgb to xyz', () => {
    const rgb = { type: 'rgb' as const, r: 1, g: 1, b: 1, alpha: 1 };
    const xyz = convertColorTo(rgb, 'xyz');

    expect(xyz.type).toBe('xyz');
    expect(xyz.x).toBeCloseTo(0.9505, 4);
    expect(xyz.y).toBeCloseTo(1.0, 4);
    expect(xyz.z).toBeCloseTo(1.0891, 3);
    expect(xyz.alpha).toBe(1);
  });

  test('converts xyz to oklab', () => {
    const xyz = { type: 'xyz' as const, x: 0.5, y: 0.5, z: 0.5, alpha: 1 };
    const oklab = convertColorTo(xyz, 'oklab');

    expect(oklab.type).toBe('oklab');
    expect(oklab.alpha).toBe(1);
  });

  test('converts oklab to oklch', () => {
    const oklab = { type: 'oklab' as const, l: 0.7, a: 0.1, b: 0.1, alpha: 1 };
    const oklch = convertColorTo(oklab, 'oklch');

    expect(oklch.type).toBe('oklch');
    expect(oklch.l).toBe(0.7);
    expect(oklch.c).toBeCloseTo(0.1414, 4);
    expect(oklch.h).toBeCloseTo(45, 1);
    expect(oklch.alpha).toBe(1);
  });

  test('converts across multiple steps: srgb to oklab', () => {
    const srgb = { type: 'srgb' as const, r: 0.8, g: 0.4, b: 0.6, alpha: 0.9 };
    const oklab = convertColorTo(srgb, 'oklab');

    expect(oklab.type).toBe('oklab');
    expect(oklab.alpha).toBe(0.9);

    // Verify round-trip
    const backToSrgb = convertColorTo(oklab, 'srgb');
    expect(backToSrgb.r).toBeCloseTo(srgb.r, 5);
    expect(backToSrgb.g).toBeCloseTo(srgb.g, 5);
    expect(backToSrgb.b).toBeCloseTo(srgb.b, 5);
  });

  test('converts backward: oklch to rgb', () => {
    const oklch = { type: 'oklch' as const, l: 0.5, c: 0.1, h: 180, alpha: 1 };
    const rgb = convertColorTo(oklch, 'rgb');

    expect(rgb.type).toBe('rgb');
    expect(rgb.alpha).toBe(1);
  });

  test('preserves alpha throughout conversions', () => {
    const srgb = { type: 'srgb' as const, r: 0.5, g: 0.5, b: 0.5, alpha: 0.3 };

    const rgb = convertColorTo(srgb, 'rgb');
    expect(rgb.alpha).toBe(0.3);

    const xyz = convertColorTo(rgb, 'xyz');
    expect(xyz.alpha).toBe(0.3);

    const oklab = convertColorTo(xyz, 'oklab');
    expect(oklab.alpha).toBe(0.3);

    const oklch = convertColorTo(oklab, 'oklch');
    expect(oklch.alpha).toBe(0.3);
  });
});

describe('deltaE', () => {
  test('returns 0 for identical colors in same color space', () => {
    const color1 = { type: 'srgb' as const, r: 0.5, g: 0.6, b: 0.7, alpha: 1 };
    const color2 = { type: 'srgb' as const, r: 0.5, g: 0.6, b: 0.7, alpha: 1 };

    expect(deltaE(color1, color2)).toBeCloseTo(0, 10);
  });

  test('returns 0 for same color in different color spaces', () => {
    const srgb = { type: 'srgb' as const, r: 1, g: 0, b: 0, alpha: 1 };
    const oklch = convertColorTo(srgb, 'oklch');

    expect(deltaE(srgb, oklch)).toBeCloseTo(0, 10);
  });

  test('calculates difference between black and white', () => {
    const black = { type: 'srgb' as const, r: 0, g: 0, b: 0, alpha: 1 };
    const white = { type: 'srgb' as const, r: 1, g: 1, b: 1, alpha: 1 };

    const diff = deltaE(black, white);
    // Black has L≈0, white has L≈1 in OKLab
    expect(diff).toBeGreaterThan(0.9);
    expect(diff).toBeLessThan(1.1);
  });

  test('calculates small difference between similar colors', () => {
    const color1 = { type: 'srgb' as const, r: 0.5, g: 0.5, b: 0.5, alpha: 1 };
    const color2 = { type: 'srgb' as const, r: 0.51, g: 0.5, b: 0.5, alpha: 1 };

    const diff = deltaE(color1, color2);
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(0.1);
  });

  test('calculates difference between red and green', () => {
    const red = { type: 'srgb' as const, r: 1, g: 0, b: 0, alpha: 1 };
    const green = { type: 'srgb' as const, r: 0, g: 1, b: 0, alpha: 1 };

    const diff = deltaE(red, green);
    expect(diff).toBeGreaterThan(0.2);
  });

  test('calculates difference between red and blue', () => {
    const red = { type: 'srgb' as const, r: 1, g: 0, b: 0, alpha: 1 };
    const blue = { type: 'srgb' as const, r: 0, g: 0, b: 1, alpha: 1 };

    const diff = deltaE(red, blue);
    expect(diff).toBeGreaterThan(0.2);
  });

  test('works with colors in different color spaces', () => {
    const srgb = { type: 'srgb' as const, r: 0.8, g: 0.4, b: 0.6, alpha: 1 };
    const oklab = { type: 'oklab' as const, l: 0.7, a: 0.1, b: 0.05, alpha: 1 };

    const diff = deltaE(srgb, oklab);
    expect(diff).toBeGreaterThan(0);
  });

  test('is symmetric', () => {
    const color1 = { type: 'srgb' as const, r: 0.3, g: 0.5, b: 0.7, alpha: 1 };
    const color2 = { type: 'oklch' as const, l: 0.6, c: 0.1, h: 180, alpha: 1 };

    expect(deltaE(color1, color2)).toBeCloseTo(deltaE(color2, color1), 10);
  });

  test('alpha does not affect color difference', () => {
    const color1 = { type: 'srgb' as const, r: 0.5, g: 0.6, b: 0.7, alpha: 1 };
    const color2 = { type: 'srgb' as const, r: 0.5, g: 0.6, b: 0.7, alpha: 0.5 };

    expect(deltaE(color1, color2)).toBeCloseTo(0, 10);
  });
});
