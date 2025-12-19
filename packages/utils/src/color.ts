type ColorType = 'srgb' | 'rgb' | 'xyz' | 'oklab' | 'oklch';

export type Color<T extends ColorType> = { type: T } & (
  | {
      type: 'srgb';
      r: number;
      g: number;
      b: number;
      alpha: number;
    }
  | {
      type: 'rgb';
      r: number;
      g: number;
      b: number;
      alpha: number;
    }
  | {
      type: 'xyz';
      x: number;
      y: number;
      z: number;
      alpha: number;
    }
  | {
      type: 'oklab';
      l: number;
      a: number;
      b: number;
      alpha: number;
    }
  | {
      type: 'oklch';
      l: number;
      c: number;
      h: number;
      alpha: number;
    }
);

/**
 * Parses CSS color strings in the format:
 * - color(srgb r g b)
 * - color(srgb r g b / alpha)
 *
 * @param colorString - CSS color string to parse
 * @returns Parsed Color object or undefined if parsing fails
 */
export const parseCSSColor = (colorString: string): Color<'srgb'> | undefined => {
  const trimmed = colorString.trim();

  // Match color(srgb r g b) or color(srgb r g b / alpha)
  const match = trimmed.match(
    /^color\(srgb\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*(-?[\d.]+))?\s*\)$/
  );

  if (!match || match.length < 4) {
    return undefined;
  }

  const r = parseFloat(match[1]!);
  const g = parseFloat(match[2]!);
  const b = parseFloat(match[3]!);
  const alpha = match[4] ? parseFloat(match[4]) : 1;

  return { r, g, b, alpha, type: 'srgb' };
};

/**
 * Converts sRGB color to linear RGB color.
 * Removes gamma correction according to CSS Color Module Level 4.
 */
export const srgbToRgb = (color: Color<'srgb'>): Color<'rgb'> => {
  const toLinear = (val: number): number => {
    const sign = val < 0 ? -1 : 1;
    const abs = Math.abs(val);

    if (abs <= 0.04045) {
      return val / 12.92;
    }

    return sign * Math.pow((abs + 0.055) / 1.055, 2.4);
  };

  return {
    type: 'rgb',
    r: toLinear(color.r),
    g: toLinear(color.g),
    b: toLinear(color.b),
    alpha: color.alpha
  };
};

/**
 * Converts linear RGB color to sRGB color.
 * Applies gamma correction according to CSS Color Module Level 4.
 */
export const rgbToSrgb = (color: Color<'rgb'>): Color<'srgb'> => {
  const toSrgb = (val: number): number => {
    const sign = val < 0 ? -1 : 1;
    const abs = Math.abs(val);

    if (abs <= 0.0031308) {
      return val * 12.92;
    }

    return sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
  };

  return {
    type: 'srgb',
    r: toSrgb(color.r),
    g: toSrgb(color.g),
    b: toSrgb(color.b),
    alpha: color.alpha
  };
};

/**
 * Converts linear RGB color to XYZ color using sRGB primaries (D65 white point).
 * According to CSS Color Module Level 4.
 */
export const rgbToXyz = (color: Color<'rgb'>): Color<'xyz'> => {
  const x = 0.4124564 * color.r + 0.3575761 * color.g + 0.1804375 * color.b;
  const y = 0.2126729 * color.r + 0.7151522 * color.g + 0.072175 * color.b;
  const z = 0.0193339 * color.r + 0.119192 * color.g + 0.9503041 * color.b;

  return {
    type: 'xyz',
    x,
    y,
    z,
    alpha: color.alpha
  };
};

/**
 * Converts XYZ color to linear RGB color using sRGB primaries (D65 white point).
 * According to CSS Color Module Level 4.
 */
export const xyzToRgb = (color: Color<'xyz'>): Color<'rgb'> => {
  const r = 3.2404542 * color.x - 1.5371385 * color.y - 0.4985314 * color.z;
  const g = -0.969266 * color.x + 1.8760108 * color.y + 0.041556 * color.z;
  const b = 0.0556434 * color.x - 0.2040259 * color.y + 1.0572252 * color.z;

  return {
    type: 'rgb',
    r,
    g,
    b,
    alpha: color.alpha
  };
};

/**
 * Converts XYZ color to Oklab color.
 * According to CSS Color Module Level 4.
 */
export const xyzToOklab = (color: Color<'xyz'>): Color<'oklab'> => {
  const l = 0.8189330101 * color.x + 0.3618667424 * color.y - 0.1288597137 * color.z;
  const m = 0.0329845436 * color.x + 0.9293118715 * color.y + 0.0361456387 * color.z;
  const s = 0.0482003018 * color.x + 0.2643662691 * color.y + 0.633851707 * color.z;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    type: 'oklab',
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: color.alpha
  };
};

/**
 * Converts Oklab color to XYZ color.
 * According to CSS Color Module Level 4.
 */
export const oklabToXyz = (color: Color<'oklab'>): Color<'xyz'> => {
  const l_ = color.l + 0.3963377774 * color.a + 0.2158037573 * color.b;
  const m_ = color.l - 0.1055613458 * color.a - 0.0638541728 * color.b;
  const s_ = color.l - 0.0894841775 * color.a - 1.291485548 * color.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    type: 'xyz',
    x: 1.2270138511 * l - 0.5577999807 * m + 0.281256149 * s,
    y: -0.0405801784 * l + 1.1122568696 * m - 0.0716766787 * s,
    z: -0.0763812845 * l - 0.4214819784 * m + 1.5861632204 * s,
    alpha: color.alpha
  };
};

/**
 * Converts Oklab color to OKLCh color (rectangular to polar coordinates).
 */
export const oklabToOklch = (color: Color<'oklab'>): Color<'oklch'> => {
  const c = Math.sqrt(color.a * color.a + color.b * color.b);
  let h = (Math.atan2(color.b, color.a) * 180) / Math.PI;

  // Normalize hue to [0, 360)
  if (h < 0) {
    h += 360;
  }

  return {
    type: 'oklch',
    l: color.l,
    c,
    h,
    alpha: color.alpha
  };
};

/**
 * Converts OKLCh color to Oklab color (polar to rectangular coordinates).
 */
export const oklchToOklab = (color: Color<'oklch'>): Color<'oklab'> => {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  return {
    type: 'oklab',
    l: color.l,
    a,
    b,
    alpha: color.alpha
  };
};

/**
 * Converts sRGB color to OKLCh color.
 * According to CSS Color Module Level 4.
 */
export const srgbToOklch = (color: Color<'srgb'>): Color<'oklch'> => {
  return oklabToOklch(xyzToOklab(rgbToXyz(srgbToRgb(color))));
};

/**
 * Converts OKLCh color to sRGB color.
 * According to CSS Color Module Level 4.
 */
export const oklchToSrgb = (color: Color<'oklch'>): Color<'srgb'> => {
  return rgbToSrgb(xyzToRgb(oklabToXyz(oklchToOklab(color))));
};

/**
 * Converts a color from one color space to another.
 * Uses the conversion chain: srgb ↔ rgb ↔ xyz ↔ oklab ↔ oklch
 *
 * @param color - The source color
 * @param targetType - The target color space type
 * @returns The color converted to the target color space
 */
export const convertColorTo = <S extends ColorType, T extends ColorType>(
  color: Color<S>,
  targetType: T
): Color<T> => {
  // Define the conversion chain order
  const colorSpaceOrder: ColorType[] = ['srgb', 'rgb', 'xyz', 'oklab', 'oklch'];
  const sourceIndex = colorSpaceOrder.indexOf(color.type);
  const targetIndex = colorSpaceOrder.indexOf(targetType);

  // If source and target are the same, return as-is
  if (sourceIndex === targetIndex) {
    return color as unknown as Color<T>;
  }

  if (sourceIndex === -1 || targetIndex === -1) {
    throw new Error(`Unknown color type: ${color.type} or ${targetType}`);
  }

  let current: Color<ColorType> = color;

  // Convert step by step through the chain
  if (sourceIndex < targetIndex) {
    // Forward conversions
    for (let i = sourceIndex; i < targetIndex; i++) {
      const fromType = colorSpaceOrder[i];
      const toType = colorSpaceOrder[i + 1];

      if (fromType === 'srgb' && toType === 'rgb') {
        current = srgbToRgb(current as Color<'srgb'>);
      } else if (fromType === 'rgb' && toType === 'xyz') {
        current = rgbToXyz(current as Color<'rgb'>);
      } else if (fromType === 'xyz' && toType === 'oklab') {
        current = xyzToOklab(current as Color<'xyz'>);
      } else if (fromType === 'oklab' && toType === 'oklch') {
        current = oklabToOklch(current as Color<'oklab'>);
      }
    }
  } else {
    // Backward conversions
    for (let i = sourceIndex; i > targetIndex; i--) {
      const fromType = colorSpaceOrder[i];
      const toType = colorSpaceOrder[i - 1];

      if (fromType === 'oklch' && toType === 'oklab') {
        current = oklchToOklab(current as Color<'oklch'>);
      } else if (fromType === 'oklab' && toType === 'xyz') {
        current = oklabToXyz(current as Color<'oklab'>);
      } else if (fromType === 'xyz' && toType === 'rgb') {
        current = xyzToRgb(current as Color<'xyz'>);
      } else if (fromType === 'rgb' && toType === 'srgb') {
        current = rgbToSrgb(current as Color<'rgb'>);
      }
    }
  }

  return current as Color<T>;
};
