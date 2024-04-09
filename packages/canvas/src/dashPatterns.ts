type DashPatternFactory = (w: number, s: number) => string;

export const DASH_PATTERNS: Partial<Record<string, DashPatternFactory>> = {
  SOLID: (_w, _s) => '',
  DASHED: (w, s) => `${w * 10}, ${s * 10}`,
  DOTTED: (_w, s) => `1, ${s * 10}`,
  DASH_DOT: (w, s) => `${w * 10}, ${s * 10}, 1, ${s * 10}`,
  DASH_DOT_DOT: (w, s) => `${w * 10}, ${s * 10}, 1, ${s * 10}, 1, ${s * 10}`
};
