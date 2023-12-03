export type DashPattern = {
  pattern: string;
};

export const DASH_PATTERNS: Record<string, DashPattern> = {
  SOLID: {
    pattern: ''
  },
  DASHED: {
    pattern: '10, 10'
  },
  DOTTED: {
    pattern: '1, 10'
  },
  DASH_DOT: {
    pattern: '10, 10, 1, 10'
  },
  DASH_DOT_DOT: {
    pattern: '10, 10, 1, 10, 1, 10'
  }
};
