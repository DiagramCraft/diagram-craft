import { type ArrowType } from '@diagram-craft/canvas/arrowShapes';

/**
 * Maps arrow notation symbols to arrow type names
 */
const ARROW_SYMBOL_MAP: Record<string, ArrowType> = {
  '<|#': 'SQUARE_ARROW_FILLED',
  '#|>': 'SQUARE_ARROW_FILLED',
  '<|': 'SQUARE_ARROW_OUTLINE',
  '|>': 'SQUARE_ARROW_OUTLINE',
  'o#': 'BALL_FILLED',
  '#o': 'BALL_FILLED',
  'o': 'BALL_OUTLINE',
  'o+': 'BALL_PLUS_OUTLINE',
  '+o': 'BALL_PLUS_OUTLINE',
  '<|<|#': 'SQUARE_DOUBLE_ARROW_FILLED',
  '#|>|>': 'SQUARE_DOUBLE_ARROW_FILLED',
  '<|<|': 'SQUARE_DOUBLE_ARROW_OUTLINE',
  '|>|>': 'SQUARE_DOUBLE_ARROW_OUTLINE',
  '[]#': 'BOX_FILLED',
  '#[]': 'BOX_FILLED',
  '[]': 'BOX_OUTLINE',
  '<>#': 'DIAMOND_FILLED',
  '#<>': 'DIAMOND_FILLED',
  '<>': 'DIAMOND_OUTLINE',
  'E': 'FORK',
  '<': 'SQUARE_STICK_ARROW',
  '>': 'SQUARE_STICK_ARROW',
  '<<': 'SQUARE_DOUBLE_STICK_ARROW',
  '>>': 'SQUARE_DOUBLE_STICK_ARROW',
  '-|': 'BAR',
  '|-': 'BAR',
  '|': 'BAR_END',
  '||': 'BAR_DOUBLE',
  '>o#': 'CROWS_FEET_BALL_FILLED',
  '#o<': 'CROWS_FEET_BALL_FILLED',
  '>o': 'CROWS_FEET_BALL',
  'o<': 'CROWS_FEET_BALL',
  '|o': 'BAR_BALL',
  'o|': 'BAR_BALL',
  ')': 'SOCKET',
  '(': 'SOCKET',
  '/': 'SLASH',
  'x': 'CROSS'
};

// Special case for CROWS_FEET which only appears without other symbols
const CROWS_FEET_LEFT = '>';
const CROWS_FEET_RIGHT = '<';

/**
 * Line pattern definitions
 */
interface LinePattern {
  strokeWidth: number;
  strokePattern?: string;
}

const LINE_PATTERN_MAP: Record<string, LinePattern> = {
  '--': { strokeWidth: 1 },
  '..': { strokeWidth: 1, strokePattern: 'dotted' },
  '-.': { strokeWidth: 1, strokePattern: 'dashed' },
  '==': { strokeWidth: 2 },
  '::': { strokeWidth: 2, strokePattern: 'dotted' },
  '=:': { strokeWidth: 2, strokePattern: 'dashed' }
};

/**
 * Result of parsing arrow notation
 */
export interface ParsedArrowNotation {
  leftArrow?: string;
  rightArrow?: string;
  strokeWidth: number;
  strokePattern?: string;
}

/**
 * Parses arrow notation and returns arrow types and line properties
 */
export function parseArrowNotation(notation: string): ParsedArrowNotation | null {
  // Try to match the pattern: [left arrow][line pattern][right arrow]
  // We need to be smart about parsing because some arrow symbols contain the line pattern chars

  // First, try to extract the line pattern from the middle
  let linePatternMatch: string | null = null;
  let linePattern: LinePattern | null | undefined = null;

  for (const pattern of Object.keys(LINE_PATTERN_MAP).sort((a, b) => b.length - a.length)) {
    const idx = notation.indexOf(pattern);
    if (idx > -1) {
      // Check if this is actually the middle section
      // For patterns like `<|#--#|>`, we want to match the `--` in the middle
      // For patterns like `<-->`, we want to match `--` in the middle
      // For patterns like `--`, the entire string is the pattern (plain line)
      const before = notation.substring(0, idx);
      const after = notation.substring(idx + pattern.length);

      // Accept if there's content on either side, or if the pattern is the entire notation
      if (before.length > 0 || after.length > 0 || notation === pattern) {
        linePatternMatch = pattern;
        linePattern = LINE_PATTERN_MAP[pattern];
        break;
      }
    }
  }

  if (!linePattern || linePatternMatch === null) {
    return null;
  }

  // Extract left and right arrow symbols
  const patternIdx = notation.indexOf(linePatternMatch);
  const leftSymbol = notation.substring(0, patternIdx);
  const rightSymbol = notation.substring(patternIdx + linePatternMatch.length);

  const result: ParsedArrowNotation = {
    strokeWidth: linePattern.strokeWidth,
    strokePattern: linePattern.strokePattern
  };

  // Special case for CROWS_FEET
  if (leftSymbol === CROWS_FEET_LEFT && rightSymbol === CROWS_FEET_RIGHT) {
    result.leftArrow = 'CROWS_FEET';
    result.rightArrow = 'CROWS_FEET';
    return result;
  }

  // Map left arrow symbol
  if (leftSymbol) {
    // Try to match from longest to shortest
    const sortedKeys = Object.keys(ARROW_SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (leftSymbol === key) {
        result.leftArrow = ARROW_SYMBOL_MAP[key];
        break;
      }
    }
  }

  // Map right arrow symbol
  if (rightSymbol) {
    const sortedKeys = Object.keys(ARROW_SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (rightSymbol === key) {
        result.rightArrow = ARROW_SYMBOL_MAP[key];
        break;
      }
    }
  }

  return result;
}

/**
 * Converts parsed arrow notation to EdgeProps
 */
export function arrowNotationToProps(notation: ParsedArrowNotation): Partial<EdgeProps> {
  const props: Partial<EdgeProps> = {
    stroke: {
      width: notation.strokeWidth
    }
  };

  if (notation.strokePattern) {
    props.stroke!.pattern = notation.strokePattern;
  }

  if (notation.leftArrow || notation.rightArrow) {
    props.arrow = {};

    if (notation.leftArrow && notation.leftArrow !== 'NONE') {
      props.arrow.start = {
        type: notation.leftArrow
      };
    }

    if (notation.rightArrow && notation.rightArrow !== 'NONE') {
      props.arrow.end = {
        type: notation.rightArrow
      };
    }
  }

  return props;
}

/**
 * Reverse mapping from arrow type to symbol
 */
const ARROW_TYPE_TO_SYMBOL: Record<string, { left: string; right: string }> = {
  SQUARE_ARROW_FILLED: { left: '<|#', right: '#|>' },
  SQUARE_ARROW_OUTLINE: { left: '<|', right: '|>' },
  BALL_FILLED: { left: 'o#', right: '#o' },
  BALL_OUTLINE: { left: 'o', right: 'o' },
  BALL_PLUS_OUTLINE: { left: 'o+', right: '+o' },
  SQUARE_DOUBLE_ARROW_FILLED: { left: '<|<|#', right: '#|>|>' },
  SQUARE_DOUBLE_ARROW_OUTLINE: { left: '<|<|', right: '|>|>' },
  BOX_FILLED: { left: '[]#', right: '#[]' },
  BOX_OUTLINE: { left: '[]', right: '[]' },
  DIAMOND_FILLED: { left: '<>#', right: '#<>' },
  DIAMOND_OUTLINE: { left: '<>', right: '<>' },
  FORK: { left: 'E', right: 'E' },
  SQUARE_STICK_ARROW: { left: '<', right: '>' },
  SQUARE_DOUBLE_STICK_ARROW: { left: '<<', right: '>>' },
  BAR: { left: '-|', right: '|-' },
  BAR_END: { left: '|', right: '|' },
  BAR_DOUBLE: { left: '||', right: '||' },
  CROWS_FEET: { left: '>', right: '<' },
  CROWS_FEET_BAR: { left: '>|', right: '|<' },
  CROWS_FEET_BALL: { left: '>o', right: 'o<' },
  CROWS_FEET_BALL_FILLED: { left: '>o#', right: '#o<' },
  BAR_BALL: { left: '|o', right: 'o|' },
  BAR_BALL_FILLED: { left: '|o#', right: '#o|' },
  ARROW_DIMENSION_STICK_ARROW: { left: '|<', right: '>|' },
  SOCKET: { left: ')', right: '(' },
  SLASH: { left: '/', right: '/' },
  CROSS: { left: 'x', right: 'x' }
};

/**
 * Converts EdgeProps to arrow notation string if it matches a standard pattern
 * Returns null if the props don't match a standard pattern
 */
export function propsToArrowNotation(props: EdgeProps): string | null {
  // Extract relevant properties
  const strokeWidth = props.stroke?.width ?? 1;
  const strokePattern = props.stroke?.pattern;
  const leftArrowType = props.arrow?.start?.type;
  const rightArrowType = props.arrow?.end?.type;

  // Find matching line pattern
  let linePatternSymbol: string | null = null;
  for (const [symbol, pattern] of Object.entries(LINE_PATTERN_MAP)) {
    if (pattern.strokeWidth === strokeWidth && pattern.strokePattern === strokePattern) {
      linePatternSymbol = symbol;
      break;
    }
  }

  // If no matching line pattern, can't generate notation
  if (!linePatternSymbol) {
    return null;
  }

  // Get arrow symbols
  let leftSymbol = '';
  let rightSymbol = '';

  if (leftArrowType && leftArrowType !== 'NONE') {
    const symbolMap = ARROW_TYPE_TO_SYMBOL[leftArrowType];
    if (!symbolMap) {
      return null;
    }
    leftSymbol = symbolMap.left;
  }

  if (rightArrowType && rightArrowType !== 'NONE') {
    const symbolMap = ARROW_TYPE_TO_SYMBOL[rightArrowType];
    if (!symbolMap) {
      return null;
    }
    rightSymbol = symbolMap.right;
  }

  // Build notation
  return leftSymbol + linePatternSymbol + rightSymbol;
}

/**
 * Parses a full arrow notation string and returns EdgeProps
 * Returns null if the notation is invalid
 */
export function parseArrowNotationToProps(notation: string): Partial<EdgeProps> | null {
  const parsed = parseArrowNotation(notation);
  if (!parsed) {
    return null;
  }
  return arrowNotationToProps(parsed);
}
