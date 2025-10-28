export type ParsedElement = {
  id: string;
  line: number; // Line number where this element is defined
} & (
  | {
      type: 'edge';
      from?: string;
      to?: string;
      label?: string;
      props?: string;
      metadata?: string;
      stylesheet?: string;
      children?: ParsedElement[];
    }
  | {
      type: 'node';
      shape: string;
      name?: string;
      props?: string;
      metadata?: string;
      stylesheet?: string;
      textStylesheet?: string;
      children?: ParsedElement[];
    }
);

type ParseResult = {
  elements: ParsedElement[];
  errors: string[];
};

/**
 * Validation rule that checks the parsed elements and returns errors keyed by line number.
 * Returns a Map where keys are line numbers and values are error messages.
 */
type ValidationRule = (elements: ParsedElement[]) => Map<number, string>;

/**
 * Context passed during parsing to track current element being parsed
 */
type ParseContext = {
  line: number; // Line number where current element is being defined
};

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
 * Recursively collect all element IDs and their line numbers from parsed elements
 */
const collectElementIds = (elements: ParsedElement[], idMap: Map<string, number[]>): void => {
  for (const element of elements) {
    if (!idMap.has(element.id)) {
      idMap.set(element.id, []);
    }
    idMap.get(element.id)!.push(element.line);

    // Recursively process children
    if (element.children) {
      collectElementIds(element.children, idMap);
    }
  }
};

/**
 * Validation rule: Check that all element IDs are unique
 */
const validateUniqueIds: ValidationRule = (elements: ParsedElement[]): Map<number, string> => {
  const errors = new Map<number, string>();
  const idMap = new Map<string, number[]>();

  // Collect all IDs and their line numbers
  collectElementIds(elements, idMap);

  // Check for duplicates
  for (const [id, lines] of idMap.entries()) {
    if (lines.length > 1) {
      // Add error to all lines where the duplicate ID appears
      for (const line of lines) {
        errors.set(line, `Duplicate element ID: "${id}"`);
      }
    }
  }

  return errors;
};

/**
 * All validation rules to run on the parsed elements
 */
const VALIDATION_RULES: ValidationRule[] = [
  validateUniqueIds
  // Add more validation rules here as needed
];

/**
 * Tokenize the input text line by line
 */
const tokenize = (text: string): { tokens: Token[]; errors: Map<number, string> } => {
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
    const elements: ParsedElement[] = [];

    // Skip any leading newlines
    this.skipNewlines();

    while (this.current().type !== TokenType.EOF) {
      const element = this.parseElement();
      if (element) {
        elements.push(element);
      }

      // Skip newlines between elements
      this.skipNewlines();
    }

    // Run validation rules on the parsed elements
    for (const rule of VALIDATION_RULES) {
      const validationErrors = rule(elements);
      // Merge validation errors with parsing errors
      for (const [line, message] of validationErrors.entries()) {
        // Only add if there's not already an error on this line
        if (!this.errors.has(line)) {
          this.errors.set(line, message);
        }
      }
    }

    const maxLine = this.errors.size > 0 ? Math.max(...this.errors.keys()) : -1;
    const errors: string[] = Array.from(
      { length: maxLine + 1 },
      (_, i) => this.errors.get(i) ?? ''
    );

    return {
      elements,
      errors
    };
  }

  private parseElement(): ParsedElement | null {
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

    const idToken = this.advance();
    const id = idToken.value;

    if (!this.expect(TokenType.COLON, 'Expected ":" after element ID')) {
      this.skipToNextLine();
      return null;
    }

    // Create parse context with line number
    const ctx: ParseContext = { line: idToken.line };

    // Check if it's an edge or node
    const nextToken = this.current();
    if (nextToken.type === TokenType.KEYWORD && nextToken.value === 'edge') {
      return this.parseEdge(id, ctx);
    } else {
      return this.parseNode(id, ctx);
    }
  }

  private parseNode(id: string, ctx: ParseContext): ParsedElement | null {
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
    this.advance(); // consume 'edge' keyword

    let from: string | undefined;
    let to: string | undefined;
    let label: string | undefined;

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
      label = this.advance().value;
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
      line: ctx.line,
      type: 'edge',
      from,
      to,
      label,
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
    children?: ParsedElement[];
  } {
    let props: string | undefined;
    let metadata: string | undefined;
    let stylesheet: string | undefined;
    let textStylesheet: string | undefined;
    const children: ParsedElement[] = [];

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

/**
 * Parses diagram text format into a list of parsed elements with error reporting.
 *
 * @param text - The diagram text to parse
 * @returns ParseResult containing the parsed elements array and any parsing errors indexed by line number
 *
 * ## Grammar
 *
 * The parser implements a line-oriented grammar where elements are separated by newlines.
 * String literals cannot span multiple lines.
 *
 * ### Node Syntax
 * ```
 * id: node-type ["name"] {
 *   stylesheet: [style] / [textStyle]
 *   props: "key=value;key2=value2"
 *   metadata: "key=value"
 *   [child elements...]
 * }
 * ```
 *
 * - **id**: Unique identifier (alphanumeric, hyphens, underscores)
 * - **node-type**: The shape/type of the node (e.g., `rect`, `rounded-rect`, `text`, `table`)
 * - **name**: Optional quoted string literal for node text/label
 * - **stylesheet**: Optional style and/or text style (format: `style / textStyle`)
 *   - Both parts optional: `/ textStyle`, `style /`, or `style / textStyle`
 *   - Only nodes support textStyle; edges only support style
 * - **props**: Optional serialized properties as semicolon-separated key=value pairs
 * - **metadata**: Optional metadata as key=value pairs
 * - **children**: Optional nested elements with same syntax
 * - **Body** (`{...}`): Optional; if omitted, element ends at newline
 *
 * ### Edge Syntax
 * ```
 * id: edge [from] -> [to] ["label"] {
 *   stylesheet: [style]
 *   props: "key=value"
 *   metadata: "key=value"
 *   [child elements...]
 * }
 * ```
 *
 * - **from/to**: Optional node IDs for connections
 *   - Can have both, one, or neither
 *   - Examples: `edge 3 -> 4`, `edge -> 4`, `edge 3 ->`, `edge`
 * - **label**: Optional quoted string (usually stored as child text node in practice)
 * - **stylesheet**: Only style part supported (no textStyle)
 * - Connection syntax must be on same line as `edge` keyword
 *
 * ### Lexical Rules
 *
 * - **Identifiers**: `[a-zA-Z0-9_-]+`
 * - **Strings**: Quoted with `"`, support escaped quotes `\"`
 * - **Keywords**: `edge`, `props`, `metadata`, `stylesheet`
 * - **Operators**: `:` (definition), `->` (edge connection), `/` (stylesheet separator)
 * - **Delimiters**: `{` `}` (body), newlines (element separator)
 * - **Comments**: Not supported
 *
 * ### Error Handling
 *
 * The parser continues after errors to provide comprehensive error reporting:
 * - Unterminated string literals
 * - Missing colons, closing braces
 * - Invalid token sequences
 * - Unexpected tokens
 *
 * Errors are reported by line number in the returned errors array.
 *
 * ## Examples
 *
 * ### Simple Node
 * ```
 * 4: rect
 * ```
 *
 * ### Node with Name and Properties
 * ```
 * 3: rounded-rect "Lorem" {
 *   props: "fill.color=#ff0000;stroke.width=2"
 * }
 * ```
 *
 * ### Node with Stylesheet
 * ```
 * 1: text "Title" {
 *   stylesheet: heading / h1
 * }
 * ```
 *
 * ### Edge with Connections
 * ```
 * e1: edge 3 -> 4 "Connection Label" {
 *   props: "arrow.end.type=ARROW"
 * }
 * ```
 *
 * ### Nested Structure (Table Example)
 * ```
 * table_1: table {
 *   row_1: tableRow {
 *     cell_1: text "Header 1" {
 *       props: "stroke.enabled=false;fill.enabled=true"
 *     }
 *     cell_2: text "Header 2" {
 *       props: "stroke.enabled=false;fill.enabled=true"
 *     }
 *   }
 *   row_2: tableRow {
 *     cell_3: text "Data 1"
 *     cell_4: text "Data 2"
 *   }
 * }
 * ```
 *
 * ### Complete Example with Multiple Elements
 * ```
 * // Edge connecting two nodes with label
 * e1: edge 3 -> 4 "Connects to" {
 *   props: "arrow.end.type=ARROW"
 * }
 *
 * // Standalone edge (no connections)
 * e2: edge
 *
 * // Node with stylesheet (textStyle only)
 * 3: rounded-rect "Lorem" {
 *   stylesheet: / h1
 * }
 *
 * // Simple node without body
 * 4: rect
 * ```
 */
export const parse = (text: string): ParseResult => {
  const { tokens, errors } = tokenize(text);
  const parser = new Parser(tokens, errors);
  return parser.parse();
};
