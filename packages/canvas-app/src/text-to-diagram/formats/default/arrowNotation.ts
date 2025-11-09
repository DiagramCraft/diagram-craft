import { type ArrowType } from '@diagram-craft/canvas/arrowShapes';

/**
 * Master mapping from arrow type to symbols (left and right variants)
 * This is the source of truth for all arrow notation mappings
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
 * Generated reverse mapping for left-side symbols
 * Built automatically from ARROW_TYPE_TO_SYMBOL
 */
const LEFT_ARROW_SYMBOL_MAP: Record<string, ArrowType> = (() => {
  const map: Record<string, ArrowType> = {};
  for (const [arrowType, symbols] of Object.entries(ARROW_TYPE_TO_SYMBOL)) {
    map[symbols.left] = arrowType as ArrowType;
  }
  return map;
})();

/**
 * Generated reverse mapping for right-side symbols
 * Built automatically from ARROW_TYPE_TO_SYMBOL
 */
const RIGHT_ARROW_SYMBOL_MAP: Record<string, ArrowType> = (() => {
  const map: Record<string, ArrowType> = {};
  for (const [arrowType, symbols] of Object.entries(ARROW_TYPE_TO_SYMBOL)) {
    map[symbols.right] = arrowType as ArrowType;
  }
  return map;
})();

type LinePattern = {
  strokeWidth: number;
  strokePattern?: string;
};

const LINE_PATTERN_MAP: Record<string, LinePattern> = {
  '--': { strokeWidth: 1 },
  '..': { strokeWidth: 1, strokePattern: 'dotted' },
  '-.': { strokeWidth: 1, strokePattern: 'dashed' },
  '==': { strokeWidth: 2 },
  '::': { strokeWidth: 2, strokePattern: 'dotted' },
  '=:': { strokeWidth: 2, strokePattern: 'dashed' }
};

export type ParsedArrowNotation = {
  leftArrow?: ArrowType | 'NONE';
  rightArrow?: ArrowType | 'NONE';
  strokeWidth: number;
  strokePattern?: string;
};

/**
 * Parses arrow notation and returns arrow types and line properties
 */
export const parseArrowNotation = (arrowString: string): ParsedArrowNotation | undefined => {
  // Try to match the pattern: [left arrow][line pattern][right arrow]
  // We need to be smart about parsing because some arrow symbols contain the line pattern chars

  // First, try to extract the line pattern from the middle
  let linePatternMatch: string | null = null;
  let linePattern: LinePattern | null | undefined = null;

  // We start by trying to find a line string (2 characters)
  for (const pattern of Object.keys(LINE_PATTERN_MAP).sort((a, b) => b.length - a.length)) {
    const idx = arrowString.indexOf(pattern);
    if (idx > -1) {
      const before = arrowString.substring(0, idx);
      const after = arrowString.substring(idx + pattern.length);

      // Accept if there's content on either side, or if the pattern is the entire notation
      if (before.length > 0 || after.length > 0 || arrowString === pattern) {
        linePatternMatch = pattern;
        linePattern = LINE_PATTERN_MAP[pattern];
        break;
      }
    }
  }

  // If there are no line characters, then this is not a line
  if (!linePattern || linePatternMatch === null) {
    return undefined;
  }

  // Else we at least have a line pattern, so we can try to extract arrows
  const result: ParsedArrowNotation = {
    strokeWidth: linePattern.strokeWidth,
    strokePattern: linePattern.strokePattern
  };

  // Extract left and right arrow symbols
  const patternIdx = arrowString.indexOf(linePatternMatch);
  const leftSymbol = arrowString.substring(0, patternIdx);
  const rightSymbol = arrowString.substring(patternIdx + linePatternMatch.length);

  // Map left arrow symbol
  if (leftSymbol) {
    // Try to match from longest to shortest
    const sortedKeys = Object.keys(LEFT_ARROW_SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (leftSymbol === key) {
        result.leftArrow = LEFT_ARROW_SYMBOL_MAP[key];
        break;
      }
    }
  }

  // Map right arrow symbol
  if (rightSymbol) {
    const sortedKeys = Object.keys(RIGHT_ARROW_SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (rightSymbol === key) {
        result.rightArrow = RIGHT_ARROW_SYMBOL_MAP[key];
        break;
      }
    }
  }

  return result;
};

/**
 * Converts parsed arrow notation to EdgeProps
 */
export const arrowNotationToProps = (notation: ParsedArrowNotation): Partial<EdgeProps> => {
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
};

/**
 * Converts EdgeProps to arrow notation string if it matches a standard pattern
 * Returns null if the props don't match a standard pattern
 */
export const propsToArrowNotation = (props: EdgeProps): string | undefined => {
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
  if (!linePatternSymbol) return undefined;

  // Get arrow symbols
  let leftSymbol = '';
  let rightSymbol = '';

  if (leftArrowType && leftArrowType !== 'NONE') {
    const symbolMap = ARROW_TYPE_TO_SYMBOL[leftArrowType];
    if (!symbolMap) return undefined;
    leftSymbol = symbolMap.left;
  }

  if (rightArrowType && rightArrowType !== 'NONE') {
    const symbolMap = ARROW_TYPE_TO_SYMBOL[rightArrowType];
    if (!symbolMap) return undefined;
    rightSymbol = symbolMap.right;
  }

  // Build notation
  return leftSymbol + linePatternSymbol + rightSymbol;
};

/**
 * Parses a full arrow notation string and returns EdgeProps
 * Returns null if the notation is invalid
 */
export const parseArrowNotationToProps = (notation: string): Partial<EdgeProps> | undefined => {
  const parsed = parseArrowNotation(notation);
  if (!parsed) return undefined;

  return arrowNotationToProps(parsed);
};
