import { TokenStream } from './token-stream';

/**
 * Represents a node in the Abstract Syntax Tree (AST) for parsed markdown.
 * All markdown elements are represented as AST nodes with a type and optional properties.
 */
export interface ASTNode {
  type: string;
  subtype?: string;
  children?: (ASTNode | string)[];
  level?: number;
  inline?: boolean;
  html?: string;
  href?: string;
  title?: string;
  source?: string;
  id?: string;
  containsEmpty?: boolean;
  followedByEmpty?: boolean;
  loose?: boolean;
}

/**
 * State object used during inline parsing to track parser position and
 * store parsed inline elements for later resolution.
 */
export type ParserState = {
  idx: number;
  inlines: ASTNode[];
  context: string[];
};

/**
 * Configuration object for creating markdown parsers.
 * Defines which block and inline parsers to use, along with flags and inheritance.
 */
export type ParserConfiguration = {
  flags?: Record<string, unknown>;
  inline?: InlineParser[];
  block?: BlockParser[];
  parent?: string;
};

/**
 * Interface for block-level markdown parsers (headers, paragraphs, lists, etc.).
 */
export interface BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean;
  excludeFromSubparse?(context: string[]): boolean;
}

/**
 * Interface for inline markdown parsers (emphasis, links, code spans, etc.).
 */
export interface InlineParser {
  parse(parser: Parser, s: string, parserState: ParserState): (ASTNode | string)[];
  excludeFromSubparse?(context: string[]): boolean;
}

/**
 * Valid parser type identifiers. 'strict' is the default implementation.
 */
export type ParserType = 'strict' | string;

/**
 * Core markdown parser that processes markdown text into an Abstract Syntax Tree (AST).
 * Uses a two-phase approach: block-level parsing followed by inline parsing.
 */
export class Parser {
  private readonly block: BlockParser[];
  private readonly inline: InlineParser[];
  private readonly flags: Record<string, unknown>;
  private readonly context: string[];
  private escapes = ['\\`*_{}[]()+-.!#', 'abcdefghijklmno'];

  /**
   * Creates a new Parser instance with the specified handlers and configuration.
   * @param blockParsers - Array of block-level parsers (headers, lists, etc.)
   * @param inlineParsers - Array of inline parsers (emphasis, links, etc.)
   * @param flags - Parser flags for customizing behavior
   * @param context - Parsing context stack for nested parsing
   */
  constructor(
    blockParsers: BlockParser[] = [],
    inlineParsers: InlineParser[] = [],
    flags: Record<string, unknown> = {},
    context: string[] = []
  ) {
    this.block = blockParsers;
    this.inline = inlineParsers;
    this.flags = flags;
    this.context = context;
  }

  /**
   * Escapes markdown special characters using a two-character mapping system.
   * Converts backslash-escaped characters into temporary escape sequences.
   * @param s - The string to escape
   * @returns String with escaped characters replaced by control sequences
   */
  escape(s: string): string {
    return s.replace(/\\[\\`*_{}[\]()+-.!#]/g, c => {
      return '\x1b' + this.escapes[1][this.escapes[0].indexOf(c[1])];
    });
  }

  /**
   * Unescapes previously escaped characters and resolves inline placeholders.
   * If a parse state is provided, also resolves inline element placeholders.
   * @param s - The string to unescape
   * @param state - Optional parse state containing inline elements
   * @returns Unescaped string or array of AST nodes/strings
   */
  unescape(s: string | undefined, state?: ParserState): (ASTNode | string)[] | string | undefined {
    if (s === undefined) return undefined;

    // eslint-disable-next-line no-control-regex
    s = s.replace(/\x1b[a-o]/g, c => {
      return this.escapes[0][this.escapes[1].indexOf(c[1])];
    });

    if (state) {
      const dest: (ASTNode | string)[] = [];
      // eslint-disable-next-line no-control-regex
      const regex = /\x1bq([0-9]+)q/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(s)) !== null) {
        if (match.index > lastIndex) {
          dest.push(s.substring(lastIndex, match.index));
        }
        dest.push(state.inlines[parseInt(match[1])]);
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < s.length) {
        dest.push(s.substring(lastIndex));
      }

      if (dest.length === 1 && typeof dest[0] === 'string') {
        return dest[0];
      }
      return dest;
    }

    return s;
  }

  /**
   * Creates a placeholder for an inline AST node during parsing.
   * Stores the node in the parse state and returns a unique placeholder string.
   * @param parserState - Current parsing state
   * @param obj - The AST node to store
   * @returns Placeholder string that will be resolved during unescaping
   */
  markParsedInline(parserState: ParserState, obj: ASTNode): string {
    return '\x1bq' + (parserState.inlines.push(obj) - 1) + 'q';
  }

  /**
   * Creates a sub-parser for nested content (like list items or blockquotes).
   * Filters out block parsers that shouldn't be used in the given context.
   * @param ctx - Additional context to add to the parsing stack
   * @returns New Parser instance configured for sub-parsing
   */
  subparser(ctx?: string | string[]): Parser {
    const newContext = this.context.concat(Array.isArray(ctx) ? ctx : ctx ? [ctx] : []);

    const filteredBlock = this.block.filter(
      b => !(b.excludeFromSubparse && b.excludeFromSubparse(newContext))
    );

    return new Parser(filteredBlock, this.inline, this.flags, newContext);
  }

  /**
   * Main parsing method that converts markdown text to AST.
   * First escapes special characters, then applies block parsers line by line,
   * and finally resolves reference links if this is the top-level parse.
   * @param s - The markdown text to parse
   * @returns Array of AST nodes representing the parsed markdown
   */
  parse(s: string): ASTNode[] {
    const stream = new TokenStream(this.escape(s));
    const ast: ASTNode[] = [];

    while (!stream.isEOS()) {
      if (stream.peek().isEmpty()) {
        stream.consume();
        continue;
      }

      let parsed = false;
      for (const blockParser of this.block) {
        if (blockParser.parse(this, stream, ast)) {
          parsed = true;
          break;
        }
      }

      if (!parsed) {
        stream.consume();
      }
    }

    if (this.context.length === 0) {
      this.resolveLinks(ast);
    }

    return ast;
  }

  /**
   * Recursively traverses the AST and applies a function to each node.
   * Handles both individual nodes and arrays of nodes.
   * @param n - AST node, array of nodes, or string to traverse
   * @param fn - Function to apply to each AST node
   */
  traverseAST(n: ASTNode[] | ASTNode | string, fn: (node: ASTNode) => void): void {
    if (Array.isArray(n)) {
      for (const item of n) {
        this.traverseAST(item, fn);
      }
    } else if (typeof n === 'object' && n !== null) {
      fn(n);
      if (n.children) {
        for (const child of n.children) {
          this.traverseAST(child, fn);
        }
      }
    }
  }

  /**
   * Resolves reference-style links by finding link definitions and applying them
   * to link references. This is a two-pass process: first collect all definitions,
   * then apply them to references.
   * @param ast - The AST to process for link resolution
   */
  resolveLinks(ast: ASTNode[]): void {
    const links: Record<string, ASTNode> = {};

    this.traverseAST(ast, n => {
      if (n.type === 'link-definition' && n.id) {
        links[n.id] = n;
      }
    });

    this.traverseAST(ast, n => {
      if (n.subtype === 'ref' && n.id) {
        const linkDef = links[n.id];
        if (linkDef) {
          // Copy all properties except 'type' from link definition to reference node
          Object.keys(linkDef).forEach(key => {
            if (key !== 'type') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (n as any)[key] = (linkDef as any)[key];
            }
          });
        }
      }
    });
  }

  /**
   * Parses inline elements within a string using the configured inline parsers.
   * Processes parsers in sequence, allowing each to handle and transform the text.
   * @param s - The string to parse for inline elements
   * @param state - Current parsing state with inline element storage
   * @param ctx - Additional context for inline parsing
   * @returns Array of AST nodes and strings representing parsed inline content
   */
  parseInlines(s: string, state?: ParserState, ctx?: string | string[]): (ASTNode | string)[] {
    const currentState: ParserState = state ?? {
      idx: 0,
      inlines: [],
      context: this.context
    };

    if (ctx) {
      currentState.context = currentState.context.concat(Array.isArray(ctx) ? ctx : [ctx]);
    }

    if (currentState.idx >= this.inline.length) {
      const result = this.unescape(s, currentState);
      return Array.isArray(result) ? result : [result ?? ''];
    }

    const nextState: ParserState = {
      idx: currentState.idx + 1,
      inlines: currentState.inlines,
      context: currentState.context
    };

    const currentParser = this.inline[currentState.idx];
    if (
      currentParser.excludeFromSubparse &&
      currentParser.excludeFromSubparse(currentState.context)
    ) {
      return this.parseInlines(s, nextState);
    }

    return currentParser.parse(this, s, nextState);
  }
}
