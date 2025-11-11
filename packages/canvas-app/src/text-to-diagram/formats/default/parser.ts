import { VALIDATION_RULES } from '../../validation';
import { assert } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import type { DiagramParser, ParsedElement, ParseErrors } from '../../types';
import { parsePropsString, parseMetadataString } from '../../utils';
import { parseArrowNotationToProps } from './arrowNotation';

type ParseResult = {
  elements: ParsedElement[];
  errors: ParseErrors;
};

/**
 * Context passed during parsing to track the current line being parsed
 */
type ParseContext = {
  line: number;
};

const KEYWORDS = new Set(['edge', 'props', 'metadata', 'stylesheet']);

enum TokenType {
  ID = 'ID',
  COLON = 'COLON',
  STRING = 'STRING',
  ARROW = 'ARROW',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  SLASH = 'SLASH',
  KEYWORD = 'KEYWORD',
  NEWLINE = 'NEWLINE',
  EOF = 'EOF'
}

type Token = {
  type: TokenType;
  value: string;
  line: number;
  col: number;
};

type TokenizationResult = { tokens: Token[]; errors: ParseErrors };

/**
 * Tokenize the input text line by line
 */
const tokenize = (text: string): TokenizationResult => {
  const tokens: Token[] = [];
  const errors = new Map<number, string>();
  const lines = text.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]!;
    let col = 0;

    while (col < line.length) {
      const char = line[col]!;

      // Skip whitespace
      if (char === ' ' || char === '\t') {
        col++;
        continue;
      }

      // String literal (cannot span lines)
      if (char === '"') {
        const startCol = col;
        col++;
        let value = '';
        let closed = false;

        while (col < line.length) {
          if (line[col] === '"') {
            closed = true;
            col++;
            break;
          }
          if (line[col] === '\\' && col + 1 < line.length) {
            // Handle escaped characters
            col++;
            value += line[col];
            col++;
          } else {
            value += line[col];
            col++;
          }
        }

        tokens.push({ type: TokenType.STRING, value, line: lineNum, col: startCol });

        if (!closed) {
          // Report error for unterminated string
          if (!errors.has(lineNum)) {
            errors.set(lineNum, 'Unterminated string literal');
          }
        }
        continue;
      }

      // Arrow notation - handle both old -> and new arrow notation
      // Special case: old syntax -> for backwards compatibility
      if (char === '-' && col + 1 < line.length && line[col + 1] === '>') {
        // Check if this is followed by a space or end of line (old syntax)
        // or if it's part of a longer arrow notation pattern
        const nextChar = col + 2 < line.length ? line[col + 2] : ' ';
        if (nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || col + 2 >= line.length) {
          // Old syntax ->
          tokens.push({ type: TokenType.ARROW, value: '->', line: lineNum, col });
          col += 2;
          continue;
        }
      }

      // Special handling for :: and =: patterns (thick dotted/dashed arrows)
      if (char === ':' && col + 1 < line.length && line[col + 1] === ':') {
        // This could be :: pattern, collect the full arrow notation
        const startCol = col;
        let notation = '::';
        col += 2;

        // Continue collecting arrow notation characters
        while (col < line.length) {
          const c = line[col]!;
          if (
            c === '-' ||
            c === '.' ||
            c === '=' ||
            c === '<' ||
            c === '>' ||
            c === '|' ||
            c === '#' ||
            c === 'o' ||
            c === '[' ||
            c === ']' ||
            c === '+' ||
            c === 'E' ||
            c === ')' ||
            c === '(' ||
            c === '/' ||
            c === 'x'
          ) {
            notation += c;
            col++;
          } else {
            break;
          }
        }

        tokens.push({ type: TokenType.ARROW, value: notation, line: lineNum, col: startCol });
        continue;
      }

      if (char === '=' && col + 1 < line.length && line[col + 1] === ':') {
        // This is =: pattern, collect the full arrow notation
        const startCol = col;
        let notation = '=:';
        col += 2;

        // Continue collecting arrow notation characters
        while (col < line.length) {
          const c = line[col]!;
          if (
            c === '-' ||
            c === '.' ||
            c === '=' ||
            c === '<' ||
            c === '>' ||
            c === '|' ||
            c === '#' ||
            c === 'o' ||
            c === '[' ||
            c === ']' ||
            c === '+' ||
            c === 'E' ||
            c === ')' ||
            c === '(' ||
            c === '/' ||
            c === 'x'
          ) {
            notation += c;
            col++;
          } else {
            break;
          }
        }

        tokens.push({ type: TokenType.ARROW, value: notation, line: lineNum, col: startCol });
        continue;
      }

      // New arrow notation - match complex patterns like <|#--#|>, ==>, .., etc.
      // We'll look for patterns that contain one of the line patterns: --, .., -., ==
      // Only try to match if we see a potential arrow notation start character
      // Note: / is treated specially - only consumed if followed by line pattern chars
      if (
        char === '-' ||
        char === '.' ||
        char === '=' ||
        char === '<' ||
        char === '>' ||
        char === '|' ||
        char === '#' ||
        char === 'o' ||
        char === '[' ||
        char === ']' ||
        char === '+' ||
        char === 'E' ||
        char === ')' ||
        char === '(' ||
        char === 'x'
      ) {
        // Try to match an arrow notation pattern
        const startCol = col;
        let notation = '';

        // Collect characters that could be part of arrow notation
        while (col < line.length) {
          const c = line[col]!;
          if (
            c === '-' ||
            c === '.' ||
            c === '=' ||
            c === '<' ||
            c === '>' ||
            c === '|' ||
            c === '#' ||
            c === 'o' ||
            c === '[' ||
            c === ']' ||
            c === '+' ||
            c === 'E' ||
            c === ')' ||
            c === '(' ||
            c === 'x'
          ) {
            notation += c;
            col++;
          } else if (
            c === '/' &&
            notation.length > 0 &&
            (notation.includes('-') || notation.includes('.') || notation.includes('='))
          ) {
            // Only include / if we've already seen some pattern chars
            notation += c;
            col++;
          } else {
            break;
          }
        }

        // Check if this contains a line pattern (indicating it's arrow notation)
        const linePatterns = ['--', '..', '-.', '=='];
        const hasLinePattern = linePatterns.some(pattern => notation.includes(pattern));

        if (hasLinePattern) {
          tokens.push({ type: TokenType.ARROW, value: notation, line: lineNum, col: startCol });
          continue;
        } else {
          // Not arrow notation, reset and treat as unknown character
          col = startCol + 1;
          continue;
        }
      }

      // Single character tokens
      if (char === ':') {
        tokens.push({ type: TokenType.COLON, value: ':', line: lineNum, col });
        col++;
        continue;
      }

      if (char === '{') {
        tokens.push({ type: TokenType.LBRACE, value: '{', line: lineNum, col });
        col++;
        continue;
      }

      if (char === '}') {
        tokens.push({ type: TokenType.RBRACE, value: '}', line: lineNum, col });
        col++;
        continue;
      }

      if (char === '/') {
        tokens.push({ type: TokenType.SLASH, value: '/', line: lineNum, col });
        col++;
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z0-9_-]/.test(char)) {
        const startCol = col;
        let value = '';
        while (col < line.length && /[a-zA-Z0-9_-]/.test(line[col]!)) {
          value += line[col];
          col++;
        }

        const type = KEYWORDS.has(value) ? TokenType.KEYWORD : TokenType.ID;
        tokens.push({ type, value, line: lineNum, col: startCol });
        continue;
      }

      // Unknown character, skip it
      col++;
    }

    // Add NEWLINE token at end of each line (including empty lines)
    tokens.push({ type: TokenType.NEWLINE, value: '\n', line: lineNum, col: line.length });
  }

  return { tokens, errors };
};

/**
 * Parser class for recursive descent parsing
 */
class Parser {
  #position: number;
  readonly #errors: Map<number, string>;

  constructor(
    private readonly tokens: Token[],
    tokenizerErrors: Map<number, string>
  ) {
    this.#position = 0;
    this.#errors = new Map(tokenizerErrors); // Start with tokenizer errors
  }

  private peek(): Token {
    return this.tokens[this.#position] ?? { type: TokenType.EOF, value: '', line: -1, col: -1 };
  }

  private next(): Token {
    const token = this.peek();
    this.#position++;
    return token;
  }

  private consume(type: TokenType, message?: string, skipToNextLine = false): Token | null {
    const token = this.peek();
    if (token.type !== type) {
      const errorMsg = message ?? `Expected ${type}, got ${token.type}`;
      this.addError(token.line, errorMsg);
      if (skipToNextLine) {
        this.skipToNextLine();
      }
      return null;
    }
    return this.next();
  }

  private addError(line: number, message: string): void {
    this.#errors.set(line, message);
  }

  private skipNewlines(): void {
    while (this.peek().type === TokenType.NEWLINE) {
      this.next();
    }
  }

  private skipToNextLine(): void {
    while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      this.next();
    }
    // Consume the newline too
    if (this.peek().type === TokenType.NEWLINE) {
      this.next();
    }
  }

  parse(): ParseResult {
    const dest: ParsedElement[] = [];

    while (this.peek().type !== TokenType.EOF) {
      this.skipNewlines();

      const element = this.parseElement();
      if (element) {
        dest.push(element);
      }
    }

    // Run validation rules on the parsed elements
    for (const rule of VALIDATION_RULES) {
      const validationErrors = rule(dest);
      // Merge validation errors with parsing errors
      for (const [line, message] of validationErrors.entries()) {
        this.#errors.set(line, message);
      }
    }

    return { elements: dest, errors: this.#errors };
  }

  private parseElement(): ParsedElement | null {
    const token = this.peek();

    if (token.type === TokenType.EOF) {
      return null;
    }

    if (token.type === TokenType.NEWLINE) {
      assert.fail('Unexpected newline at top level');
    }

    // Parse: [id]: ... (id can be either ID or STRING token, or omitted)
    // If ID is omitted (starts with ':'), auto-generate one
    let id: string;
    let lineNum: number;

    if (token.type === TokenType.COLON) {
      // Auto-generate ID when element starts with ':'
      id = newid();
      lineNum = token.line;
      this.next(); // consume the colon
    } else if (token.type === TokenType.ID || token.type === TokenType.STRING) {
      // Explicit ID provided
      const idToken = this.next();
      id = idToken.value;
      lineNum = idToken.line;

      if (!this.consume(TokenType.COLON, 'Expected ":" after element ID')) {
        this.skipToNextLine();
        return null;
      }
    } else {
      this.addError(token.line, `Expected element ID or ':', got ${token.type}`);
      this.skipToNextLine();
      return null;
    }

    // Check if it's an edge or node
    const nextToken = this.peek();
    if (nextToken.type === TokenType.KEYWORD && nextToken.value === 'edge') {
      return this.parseEdge(id, { line: lineNum });
    } else {
      return this.parseNode(id, { line: lineNum });
    }
  }

  private parseNode(id: string, ctx: ParseContext): ParsedElement | null {
    // Parse node type
    const typeToken = this.peek();
    if (typeToken.type !== TokenType.ID && typeToken.type !== TokenType.KEYWORD) {
      this.addError(typeToken.line, 'Expected node type');
      this.skipToNextLine();
      return null;
    }

    const shape = this.next().value;

    // Optional: name (must be before newline or brace)
    let name: string | undefined;
    if (this.peek().type === TokenType.STRING) {
      name = this.next().value;
    }

    // Expect end of line or opening brace
    if (
      this.peek().type !== TokenType.NEWLINE &&
      this.peek().type !== TokenType.LBRACE &&
      this.peek().type !== TokenType.EOF
    ) {
      this.addError(this.peek().line, 'Unexpected token after node definition');
      this.skipToNextLine();
    }

    // Optional: body with props, metadata, children
    const { props, metadata, stylesheet, textStylesheet, children } = this.parseBody();

    return {
      id,
      line: ctx.line,
      type: 'node',
      shape,
      name,
      props,
      metadata,
      stylesheet,
      textStylesheet,
      children
    };
  }

  private parseEdge(id: string, ctx: ParseContext): ParsedElement | null {
    this.next(); // consume 'edge' keyword

    let from: string | undefined;
    let to: string | undefined;
    let label: string | undefined;
    let arrowNotationProps: Partial<DiagramCraft.EdgeProps> | undefined;

    // Optional: from -> to (must be before newline or brace)
    // IDs can be either ID or STRING tokens (for quoted IDs with spaces)
    const nextToken = this.peek();
    if (nextToken.type === TokenType.ID || nextToken.type === TokenType.STRING) {
      from = this.next().value;

      if (this.peek().type === TokenType.ARROW) {
        const arrowToken = this.next(); // consume arrow notation
        const notation = arrowToken.value;

        // Only parse arrow notation if it's not the old syntax ->
        if (notation !== '->') {
          const parsedProps = parseArrowNotationToProps(notation);
          if (parsedProps) {
            arrowNotationProps = parsedProps;
          } else {
            this.addError(arrowToken.line, `Invalid arrow notation: ${notation}`);
          }
        }

        const toToken = this.peek();
        if (toToken.type === TokenType.ID || toToken.type === TokenType.STRING) {
          to = this.next().value;
        }
      }
    } else if (nextToken.type === TokenType.ARROW) {
      // Case: edge -> to
      const arrowToken = this.next(); // consume arrow notation
      const notation = arrowToken.value;

      // Only parse arrow notation if it's not the old syntax ->
      if (notation !== '->') {
        const parsedProps = parseArrowNotationToProps(notation);
        if (parsedProps) {
          arrowNotationProps = parsedProps;
        } else {
          this.addError(arrowToken.line, `Invalid arrow notation: ${notation}`);
        }
      }

      const toToken = this.peek();
      if (toToken.type === TokenType.ID || toToken.type === TokenType.STRING) {
        to = this.next().value;
      }
    }

    // Optional: label (must be before newline or brace)
    if (this.peek().type === TokenType.STRING) {
      label = this.next().value;
    }

    // Expect end of line or opening brace
    if (
      this.peek().type !== TokenType.NEWLINE &&
      this.peek().type !== TokenType.LBRACE &&
      this.peek().type !== TokenType.EOF
    ) {
      this.addError(this.peek().line, 'Unexpected token after edge definition');
      this.skipToNextLine();
    }

    // Optional: body
    const { props, metadata, stylesheet, textStylesheet, children } = this.parseBody();

    // Merge arrow notation props with explicit props (explicit props override)
    let finalProps = props;
    if (arrowNotationProps) {
      finalProps = this.mergeProps(arrowNotationProps, props);
    }

    // Warn if textStylesheet was specified for an edge
    if (textStylesheet) {
      this.addError(this.peek().line, 'Edges cannot have textStylesheet');
    }

    return {
      id,
      line: ctx.line,
      type: 'edge',
      from,
      to,
      label,
      props: finalProps,
      metadata,
      stylesheet,
      children
    };
  }

  /**
   * Merges arrow notation props with explicit props
   * Explicit props take precedence over arrow notation props
   */
  private mergeProps(
    arrowNotationProps: Partial<DiagramCraft.EdgeProps>,
    explicitProps?: Partial<DiagramCraft.NodeProps | DiagramCraft.EdgeProps>
  ): Partial<DiagramCraft.EdgeProps> {
    if (!explicitProps) {
      return arrowNotationProps;
    }

    // Deep merge props - explicit props override arrow notation props
    const merged: Partial<DiagramCraft.EdgeProps> = { ...arrowNotationProps };

    // Handle stroke properties
    if (explicitProps.stroke) {
      merged.stroke = {
        ...arrowNotationProps.stroke,
        ...explicitProps.stroke
      };
    }

    // Handle arrow properties
    if ('arrow' in explicitProps && explicitProps.arrow) {
      merged.arrow = {
        start: {
          ...arrowNotationProps.arrow?.start,
          ...explicitProps.arrow?.start
        },
        end: {
          ...arrowNotationProps.arrow?.end,
          ...explicitProps.arrow?.end
        }
      };
    }

    // Copy all other explicit props
    for (const key in explicitProps) {
      if (key !== 'stroke' && key !== 'arrow') {
        // biome-ignore lint/suspicious/noExplicitAny: any is the easiest solution
        (merged as any)[key] = (explicitProps as any)[key];
      }
    }

    return merged;
  }

  private parseBody(): {
    props?: Partial<DiagramCraft.NodeProps | DiagramCraft.EdgeProps>;
    metadata?: Partial<DiagramCraft.ElementMetadata>;
    stylesheet?: string;
    textStylesheet?: string;
    children?: ParsedElement[];
  } {
    // Check for opening brace
    if (this.peek().type !== TokenType.LBRACE) {
      return {
        props: undefined,
        metadata: undefined,
        stylesheet: undefined,
        textStylesheet: undefined,
        children: undefined
      };
    }

    let props: Partial<DiagramCraft.NodeProps | DiagramCraft.EdgeProps> | undefined;
    let metadata: Partial<DiagramCraft.ElementMetadata> | undefined;
    let stylesheet: string | undefined;
    let textStylesheet: string | undefined;
    const children: ParsedElement[] = [];

    this.consume(TokenType.LBRACE);

    while (this.peek().type !== TokenType.RBRACE && this.peek().type !== TokenType.EOF) {
      const token = this.peek();

      // Skip newlines within body
      if (token.type === TokenType.NEWLINE) {
        this.next();
        continue;
      }

      // Handle props, metadata, stylesheet
      if (token.type === TokenType.KEYWORD) {
        if (token.value === 'props') {
          this.next();
          if (!this.consume(TokenType.COLON, 'Expected ":" after props:', true)) {
            continue;
          }
          const str = this.consume(TokenType.STRING, 'Expected string after props:', true);
          if (str && !props) {
            props = parsePropsString(str.value);
          }
        } else if (token.value === 'metadata') {
          this.next();
          if (!this.consume(TokenType.COLON, 'Expected ":" after metadata:', true)) {
            continue;
          }

          const str = this.consume(TokenType.STRING, 'Expected string after metadata:', true);
          if (str && !metadata) {
            metadata = parseMetadataString(str.value);
          }
        } else if (token.value === 'stylesheet') {
          this.next();
          if (!this.consume(TokenType.COLON, 'Expected ":" after stylesheet:', true)) {
            continue;
          }
          // Parse stylesheet: [style] / [textStyle]
          // Format can be: "style /", "/ textStyle", or "style / textStyle"
          const currentToken = this.peek();

          // Check if starts with slash (meaning no style, only textStyle)
          if (currentToken.type === TokenType.SLASH) {
            this.next(); // consume /
            if (this.peek().type === TokenType.ID) {
              textStylesheet = this.next().value;
            }
          } else if (currentToken.type === TokenType.ID) {
            // First ID is the stylesheet
            stylesheet = this.next().value;

            // Check if there's a slash followed by textStyle
            if (this.peek().type === TokenType.SLASH) {
              this.next(); // consume /
              if (this.peek().type === TokenType.ID) {
                textStylesheet = this.next().value;
              }
            }
          }

          // Consume rest of line
          this.skipToNextLine();
        } else {
          this.addError(token.line, `Unknown keyword: ${token.value}`);
          this.skipToNextLine();
        }
      } else if (
        token.type === TokenType.ID ||
        token.type === TokenType.STRING ||
        token.type === TokenType.COLON
      ) {
        // Child element (ID can be explicit or auto-generated with ':')
        const child = this.parseElement();
        if (child) {
          children.push(child);
        }
      } else {
        // Unexpected token, skip to next line
        this.addError(token.line, `Unexpected token in body: ${token.type}`);
        this.skipToNextLine();
      }
    }

    if (this.peek().type === TokenType.RBRACE) {
      this.next(); // consume }
    } else if (this.peek().type !== TokenType.EOF) {
      this.addError(this.peek().line, 'Expected closing brace');
    } else {
      // EOF reached without closing brace - report error on last token
      const lastToken = this.tokens[this.#position - 1];
      if (lastToken) {
        this.addError(lastToken.line, 'Expected closing brace');
      }
    }

    return {
      props,
      metadata,
      stylesheet,
      textStylesheet,
      children: children.length > 0 ? children : undefined
    };
  }
}

/**
 * Default format parser implementation
 */
export const defaultParser: DiagramParser = {
  parse(text: string): { elements: ParsedElement[]; errors: ParseErrors } {
    const { tokens, errors } = tokenize(text);
    const parser = new Parser(tokens, errors);
    return parser.parse();
  }
};
