type ASTShape = {
  id: string;
} & (
  | {
      type: 'edge';
      from?: string;
      to?: string;
      props?: string;
      metadata?: string;
      stylesheet?: string;
      children?: ASTShape[];
    }
  | {
      type: 'node';
      shape: string;
      name?: string;
      props?: string;
      metadata?: string;
      stylesheet?: string;
      textStylesheet?: string;
      children?: ASTShape[];
    }
);

type ParseResult = {
  ast: ASTShape[];
  errors: string[];
};

/**
 * This parses the text and returns the AST as well as
 * an array of errors (indexed by the line number)
 *
 * The input text follows the following format:
 * ```
 * [id]: [type] ("[name]") {
 *   (props: "string")
 *   (metadata: "string")
 *   (children)
 * }
 * [id]: edge (("[from]") -> ("[to]")) ("[label]"){
 *   (props: "string")
 *   (metadata: "string")
 *   (children)
 * }
 * ```
 *
 * Example:
 * ```
 * e1: edge 3 -> 4 "Hello world" {
 *   t2: text "Hello world" {
 *     props: "labelForEdgeId=e1;text.align=center;fill.enabled=true;fill.color=#ffffff"
 *   }
 *   props: "arrow.start.type=SQUARE_ARROW_OUTLINE;arrow.end.type=CROWS_FEET_BAR"
 * }
 *
 * e2: edge
 *
 * 3: rounded-rect "Lorem" {
 *   stylesheet: / h1
 * }
 *
 * 4: rect
 *
 * epb7kko: table {
 *   el4hq06: tableRow {
 *     cukdoml: text "Lorem ipsum" {
 *       props: "stroke.enabled=false;fill.enabled=true"
 *     }
 *     3p0ktgd: text "Dolor sit amet" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#f7edfe"
 *     }
 *     props: "custom.container.containerResize=both;custom.container.layout=horizontal;custom.container.childResize=fill;custom.container.gapType=around;custom.container.gap=0"
 *   }
 *   ekk5sda: tableRow {
 *     nq982mr: text "Consectetur adipiscing elit" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#d2deff"
 *     }
 *     rpvl4ar: text "12345" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#e9f6e9"
 *     }
 *     props: "custom.container.containerResize=both;custom.container.layout=horizontal;custom.container.childResize=fill;custom.container.gapType=around;custom.container.gap=0"
 *   }
 *   props: "custom.container.containerResize=both;custom.container.layout=vertical;custom.container.childResize=scale;custom.container.gapType=around;custom.container.gap=10;custom.table.gap=0"
 * }
 * ```
 *
 */

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

const KEYWORDS = new Set(['edge', 'props', 'metadata', 'stylesheet']);

/**
 * Tokenize the input text line by line
 */
const tokenize = (
  text: string
): { tokens: Token[]; errors: Map<number, string> } => {
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

      // Arrow ->
      if (char === '-' && col + 1 < line.length && line[col + 1] === '>') {
        tokens.push({ type: TokenType.ARROW, value: '->', line: lineNum, col });
        col += 2;
        continue;
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
  private tokens: Token[];
  private pos: number;
  private errors: Map<number, string>;

  constructor(tokens: Token[], tokenizerErrors: Map<number, string>) {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = new Map(tokenizerErrors); // Start with tokenizer errors
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', line: -1, col: -1 };
  }


  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType, message?: string): Token | null {
    const token = this.current();
    if (token.type !== type) {
      const errorMsg = message ?? `Expected ${type}, got ${token.type}`;
      this.addError(token.line, errorMsg);
      return null;
    }
    return this.advance();
  }

  private addError(line: number, message: string): void {
    if (!this.errors.has(line)) {
      this.errors.set(line, message);
    }
  }

  /**
   * Skip any number of NEWLINE tokens
   */
  private skipNewlines(): void {
    while (this.current().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  /**
   * Consume tokens until we hit a NEWLINE or EOF
   */
  private skipToNextLine(): void {
    while (this.current().type !== TokenType.NEWLINE && this.current().type !== TokenType.EOF) {
      this.advance();
    }
    // Consume the newline too
    if (this.current().type === TokenType.NEWLINE) {
      this.advance();
    }
  }


  parse(): ParseResult {
    const ast: ASTShape[] = [];

    // Skip any leading newlines
    this.skipNewlines();

    while (this.current().type !== TokenType.EOF) {
      const element = this.parseElement();
      if (element) {
        ast.push(element);
      }

      // Skip newlines between elements
      this.skipNewlines();
    }

    const maxLine = this.errors.size > 0 ? Math.max(...this.errors.keys()) : -1;
    const errors: string[] = Array.from({ length: maxLine + 1 }, (_, i) => this.errors.get(i) ?? '');

    return {
      ast,
      errors
    };
  }

  private parseElement(): ASTShape | null {
    const token = this.current();

    // Handle closing braces at top level (error recovery)
    if (token.type === TokenType.RBRACE) {
      this.advance(); // consume the extra brace
      return null;
    }

    // Shouldn't happen due to skipNewlines in parse(), but just in case
    if (token.type === TokenType.NEWLINE) {
      this.advance();
      return null;
    }

    if (token.type === TokenType.EOF) {
      return null;
    }

    // Parse: id: ...
    if (token.type !== TokenType.ID) {
      this.addError(token.line, `Expected element ID, got ${token.type}`);
      this.skipToNextLine();
      return null;
    }

    const id = this.advance().value;

    if (!this.expect(TokenType.COLON, 'Expected ":" after element ID')) {
      this.skipToNextLine();
      return null;
    }

    // Check if it's an edge or node
    const nextToken = this.current();
    if (nextToken.type === TokenType.KEYWORD && nextToken.value === 'edge') {
      return this.parseEdge(id);
    } else {
      return this.parseNode(id);
    }
  }

  private parseNode(id: string): ASTShape | null {
    // Parse node type
    const typeToken = this.current();
    if (typeToken.type !== TokenType.ID && typeToken.type !== TokenType.KEYWORD) {
      this.addError(typeToken.line, 'Expected node type');
      this.skipToNextLine();
      return null;
    }

    const shape = this.advance().value;

    // Optional: name (must be before newline or brace)
    let name: string | undefined;
    if (this.current().type === TokenType.STRING) {
      name = this.advance().value;
    }

    // Expect end of line or opening brace
    if (
      this.current().type !== TokenType.NEWLINE &&
      this.current().type !== TokenType.LBRACE &&
      this.current().type !== TokenType.EOF
    ) {
      this.addError(this.current().line, 'Unexpected token after node definition');
      this.skipToNextLine();
    }

    // Optional: body with props, metadata, children
    const { props, metadata, stylesheet, textStylesheet, children } = this.parseBody();

    return {
      id,
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

  private parseEdge(id: string): ASTShape | null {
    this.advance(); // consume 'edge' keyword

    let from: string | undefined;
    let to: string | undefined;

    // Optional: from -> to (must be before newline or brace)
    const nextToken = this.current();
    if (nextToken.type === TokenType.ID) {
      from = this.advance().value;

      if (this.current().type === TokenType.ARROW) {
        this.advance(); // consume ->

        if (this.current().type === TokenType.ID) {
          to = this.advance().value;
        }
      }
    } else if (nextToken.type === TokenType.ARROW) {
      // Case: edge -> to
      this.advance(); // consume ->
      if (this.current().type === TokenType.ID) {
        to = this.advance().value;
      }
    }

    // Optional: label (must be before newline or brace)
    if (this.current().type === TokenType.STRING) {
      this.advance().value; // consume but don't use - label is in labelNodes
    }

    // Expect end of line or opening brace
    if (
      this.current().type !== TokenType.NEWLINE &&
      this.current().type !== TokenType.LBRACE &&
      this.current().type !== TokenType.EOF
    ) {
      this.addError(this.current().line, 'Unexpected token after edge definition');
      this.skipToNextLine();
    }

    // Optional: body
    const { props, metadata, stylesheet, textStylesheet, children } = this.parseBody();

    // Warn if textStylesheet was specified for an edge
    if (textStylesheet) {
      this.addError(this.current().line, 'Edges cannot have textStylesheet');
    }

    return {
      id,
      type: 'edge',
      from,
      to,
      props,
      metadata,
      stylesheet,
      children
    };
  }

  private parseBody(): {
    props?: string;
    metadata?: string;
    stylesheet?: string;
    textStylesheet?: string;
    children?: ASTShape[];
  } {
    let props: string | undefined;
    let metadata: string | undefined;
    let stylesheet: string | undefined;
    let textStylesheet: string | undefined;
    const children: ASTShape[] = [];

    // Check for opening brace
    if (this.current().type !== TokenType.LBRACE) {
      return {
        props,
        metadata,
        stylesheet,
        textStylesheet,
        children: children.length > 0 ? children : undefined
      };
    }

    this.advance(); // consume {
    this.skipNewlines(); // Skip newlines after opening brace

    while (this.current().type !== TokenType.RBRACE && this.current().type !== TokenType.EOF) {
      const token = this.current();

      // Skip newlines within body
      if (token.type === TokenType.NEWLINE) {
        this.advance();
        continue;
      }

      // Handle props, metadata, stylesheet
      if (token.type === TokenType.KEYWORD) {
        if (token.value === 'props') {
          this.advance();
          if (!this.expect(TokenType.COLON)) {
            this.skipToNextLine();
            continue;
          }
          if (this.current().type === TokenType.STRING) {
            props = this.advance().value;
          } else {
            this.addError(token.line, 'Expected string after props:');
            this.skipToNextLine();
          }
        } else if (token.value === 'metadata') {
          this.advance();
          if (!this.expect(TokenType.COLON)) {
            this.skipToNextLine();
            continue;
          }
          if (this.current().type === TokenType.STRING) {
            metadata = this.advance().value;
          } else {
            this.addError(token.line, 'Expected string after metadata:');
            this.skipToNextLine();
          }
        } else if (token.value === 'stylesheet') {
          this.advance();
          if (!this.expect(TokenType.COLON)) {
            this.skipToNextLine();
            continue;
          }
          // Parse stylesheet: [style] / [textStyle]
          // Format can be: "style /", "/ textStyle", or "style / textStyle"
          const currentToken = this.current();

          // Check if starts with slash (meaning no style, only textStyle)
          if (currentToken.type === TokenType.SLASH) {
            this.advance(); // consume /
            if (this.current().type === TokenType.ID) {
              textStylesheet = this.advance().value;
            }
          } else if (currentToken.type === TokenType.ID) {
            // First ID is the stylesheet
            stylesheet = this.advance().value;

            // Check if there's a slash followed by textStyle
            if (this.current().type === TokenType.SLASH) {
              this.advance(); // consume /
              if (this.current().type === TokenType.ID) {
                textStylesheet = this.advance().value;
              }
            }
          }

          // Consume rest of line
          this.skipToNextLine();
        } else {
          this.addError(token.line, `Unknown keyword: ${token.value}`);
          this.skipToNextLine();
        }
      } else if (token.type === TokenType.ID) {
        // Child element
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

    if (this.current().type === TokenType.RBRACE) {
      this.advance(); // consume }
    } else if (this.current().type !== TokenType.EOF) {
      this.addError(this.current().line, 'Expected closing brace');
    } else {
      // EOF reached without closing brace - report error on last token
      const lastToken = this.tokens[this.pos - 1];
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

export const parse = (text: string): ParseResult => {
  const { tokens, errors } = tokenize(text);
  const parser = new Parser(tokens, errors);
  return parser.parse();
};
