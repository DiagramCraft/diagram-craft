/**
 * Parses the aspect ratio (height / width) from an SVG string's viewBox attribute.
 * Returns 1 if the viewBox is missing or invalid.
 */
export const svgAspectRatio = (svg: string): number => {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) return 1;
  const parts = match[1]!.trim().split(/[\s,]+/);
  if (parts.length < 4) return 1;
  const w = parseFloat(parts[2]!);
  const h = parseFloat(parts[3]!);
  return w > 0 && h > 0 ? h / w : 1;
};
