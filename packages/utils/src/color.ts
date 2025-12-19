export type Color = {
  r: number;
  g: number;
  b: number;
  alpha: number;
};

/**
 * Parses CSS color strings in the format:
 * - color(srgb r g b)
 * - color(srgb r g b / alpha)
 *
 * @param colorString - CSS color string to parse
 * @returns Parsed Color object or undefined if parsing fails
 */
export const parseCSSColor = (colorString: string): Color | undefined => {
  const trimmed = colorString.trim();

  // Match color(srgb r g b) or color(srgb r g b / alpha)
  const match = trimmed.match(/^color\(srgb\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*(-?[\d.]+))?\s*\)$/);

  if (!match || match.length < 4) {
    return undefined;
  }

  const r = parseFloat(match[1]!);
  const g = parseFloat(match[2]!);
  const b = parseFloat(match[3]!);
  const alpha = match[4] ? parseFloat(match[4]) : 1;

  return { r, g, b, alpha };
};
