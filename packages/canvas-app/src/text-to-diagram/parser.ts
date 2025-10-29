import { VALIDATION_RULES } from './parser.validation';
import { assert } from '@diagram-craft/utils/assert';

export type ParsedElement = {
  id: string;
  line: number; // Line number where this element is defined
  props?: string;
  metadata?: string;
  stylesheet?: string;
  children?: ParsedElement[];
} & (
  | {
      type: 'edge';
      from?: string;
      to?: string;
      label?: string;
    }
  | {
      type: 'node';
      shape: string;
      name?: string;
      textStylesheet?: string;
    }
);

export type ParseErrors = Map<number, string>;

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

    // Parse: id: ... (id can be either ID or STRING token)
    if (token.type !== TokenType.ID && token.type !== TokenType.STRING) {
      this.addError(token.line, `Expected element ID, got ${token.type}`);
      this.skipToNextLine();
      return null;
    }

    const idToken = this.next();
    const id = idToken.value;

    if (!this.consume(TokenType.COLON, 'Expected ":" after element ID')) {
      this.skipToNextLine();
      return null;
    }

    // Check if it's an edge or node
    const nextToken = this.peek();
    if (nextToken.type === TokenType.KEYWORD && nextToken.value === 'edge') {
      return this.parseEdge(id, { line: idToken.line });
    } else {
      return this.parseNode(id, { line: idToken.line });
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

    // Optional: from -> to (must be before newline or brace)
    // IDs can be either ID or STRING tokens (for quoted IDs with spaces)
    const nextToken = this.peek();
    if (nextToken.type === TokenType.ID || nextToken.type === TokenType.STRING) {
      from = this.next().value;

      if (this.peek().type === TokenType.ARROW) {
        this.next(); // consume ->

        const toToken = this.peek();
        if (toToken.type === TokenType.ID || toToken.type === TokenType.STRING) {
          to = this.next().value;
        }
      }
    } else if (nextToken.type === TokenType.ARROW) {
      // Case: edge -> to
      this.next(); // consume ->
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

    let props: string | undefined;
    let metadata: string | undefined;
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
          props ??= str?.value;
        } else if (token.value === 'metadata') {
          this.next();
          if (!this.consume(TokenType.COLON, 'Expected ":" after metadata:', true)) {
            continue;
          }

          const str = this.consume(TokenType.STRING, 'Expected string after metadata:', true);
          metadata ??= str?.value;
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
      } else if (token.type === TokenType.ID || token.type === TokenType.STRING) {
        // Child element (ID can be quoted or unquoted)
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
 * - **id**: Unique identifier
 *   - Unquoted: alphanumeric, hyphens, underscores (e.g., `myNode`, `node-1`, `node_2`)
 *   - Quoted: any string with spaces must be quoted (e.g., `"my node"`, `"node 1"`)
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
 * - **from/to**: Optional node IDs for connections (can be quoted or unquoted)
 *   - Can have both, one, or neither
 *   - Examples: `edge 3 -> 4`, `edge -> 4`, `edge 3 ->`, `edge`
 *   - With spaces: `edge "node 1" -> "node 2"`, `edge "from node" ->`, `edge -> "to node"`
 * - **label**: Optional quoted string (usually stored as child text node in practice)
 * - **stylesheet**: Only style part supported (no textStyle)
 * - Connection syntax must be on same line as `edge` keyword
 *
 * ### Lexical Rules
 *
 * - **Identifiers**: `[a-zA-Z0-9_-]+` (unquoted IDs)
 * - **Strings**: Quoted with `"`, support escaped quotes `\"` (used for quoted IDs and labels)
 * - **Keywords**: `edge`, `props`, `metadata`, `stylesheet`
 * - **Operators**: `:` (definition), `->` (edge connection), `/` (stylesheet separator)
 * - **Delimiters**: `{` `}` (body), newlines (element separator)
 * - **Comments**: Not supported
 * - **Quoted IDs**: IDs containing spaces must be quoted (e.g., `"my node"`)
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
 *
 * ### Examples with Quoted IDs (IDs containing spaces)
 * ```
 * // Node with quoted ID
 * "my node": rect "My Rectangle"
 *
 * // Edge with quoted ID and endpoints
 * "edge 1": edge "my node" -> "another node"
 *
 * // Mixed quoted and unquoted IDs
 * simpleNode: circle
 * "node with spaces": rect
 * e1: edge simpleNode -> "node with spaces"
 *
 * // Nested elements with quoted IDs
 * "parent table": table {
 *   "child row": tableRow {
 *     "cell 1": text "First Cell"
 *   }
 * }
 * ```
 */
export const parse = (text: string): ParseResult => {
  const { tokens, errors } = tokenize(text);
  const parser = new Parser(tokens, errors);
  return parser.parse();
};
