import { TokenStream } from './token-stream';
import { Util } from './utils';

interface BaseASTNode {
  children?: (ASTNode | string)[];
}

interface HTMLASTNode extends BaseASTNode {
  type: 'html';
  subtype?: 'comment' | undefined;
  html?: string;
}

interface LinkASTNode extends BaseASTNode {
  type: 'link' | 'image';
  href?: string;
  title?: string;
  source?: string;
  subtype?: 'ref' | undefined;
  id?: string;
}

interface LinkDefinitionASTNode extends BaseASTNode {
  type: 'link-definition';
  href?: string;
  title?: string;
  source?: string;
  subtype?: 'ref' | undefined;
  id?: string;
}

interface BlockquoteASTNode extends BaseASTNode {
  type: 'blockquote';
}

interface EmphasisASTNode extends BaseASTNode {
  type: 'emphasis';
}

interface StrongASTNode extends BaseASTNode {
  type: 'strong';
}

interface LineBreakASTNode extends BaseASTNode {
  type: 'line-break';
}

interface HRASTNode extends BaseASTNode {
  type: 'hr';
}

interface ParagraphASTNode extends BaseASTNode {
  type: 'paragraph';
}

interface CodeASTNode extends BaseASTNode {
  type: 'code';
  inline?: boolean;
  source?: string;
}

interface ListASTNode extends BaseASTNode {
  type: 'list';
  subtype: 'ordered' | 'unordered';
  level?: number;
}

interface ItemASTNode extends BaseASTNode {
  type: 'item';
  containsEmpty?: boolean;
  followedByEmpty?: boolean;
  loose?: boolean;
}

interface HeadingASTNode extends BaseASTNode {
  type: 'heading';
  level?: number;
}

/**
 * Represents a node in the Abstract Syntax Tree (AST) for parsed markdown.
 * All markdown elements are represented as AST nodes with a type and optional properties.
 */
export type ASTNode =
  | HTMLASTNode
  | LinkASTNode
  | LinkDefinitionASTNode
  | BlockquoteASTNode
  | EmphasisASTNode
  | StrongASTNode
  | LineBreakASTNode
  | HRASTNode
  | ParagraphASTNode
  | CodeASTNode
  | ListASTNode
  | ItemASTNode
  | HeadingASTNode;

export type ASTNodeOfType<T extends ASTNode['type']> = ASTNode & { type: T };

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
export abstract class InlineParser {
  abstract parse(parser: Parser, s: string, parserState: ParserState): (ASTNode | string)[];
  excludeFromSubparse(_context: string[]) {
    return false;
  }

  /**
   * Shared function for applying inline regex patterns to text.
   */
  protected applyInlineRegExp(
    parser: Parser,
    parserState: ParserState,
    s: string,
    re: RegExp,
    fn: (match: RegExpExecArray, progress?: (length: number) => void) => ASTNode | null
  ): (ASTNode | string)[] {
    const dest: string[] = [];
    Util.iterateRegex(re, s, m => {
      let p: number | undefined;
      if (typeof m === 'string') {
        dest.push(m);
      } else {
        const inlineASTNode = fn(m, (i: number) => (p = i));
        if (!inlineASTNode) {
          dest.push(m[0]);
        } else {
          dest.push(parser.addInline(parserState, inlineASTNode));
        }
      }
      return p;
    });

    return parser.parseInlines(dest.join(''), parserState);
  }
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
  readonly block: BlockParser[];
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

  unescape(s: string): string {
    // eslint-disable-next-line no-control-regex
    s = s.replace(/\x1b[a-o]/g, c => {
      return this.escapes[0][this.escapes[1].indexOf(c[1])];
    });

    return s;
  }

  /**
   * Unescapes previously escaped characters and resolves inline placeholders.
   * If a parse state is provided, also resolves inline element placeholders.
   * @param s - The string to unescape
   * @param state - Optional parse state containing inline elements
   * @returns Unescaped string or array of AST nodes/strings
   */
  resolveInlines(s: string, state: ParserState): (ASTNode | string)[] | undefined {
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

    return dest;
  }

  /**
   * Creates a placeholder for an inline AST node during parsing.
   * Stores the node in the parse state and returns a unique placeholder string.
   * @param parserState - Current parsing state
   * @param obj - The AST node to store
   * @returns Placeholder string that will be resolved during unescaping
   */
  addInline(parserState: ParserState, obj: ASTNode): string {
    return '\x1bq' + (parserState.inlines.push(obj) - 1) + 'q';
  }

  /**
   * Creates a sub-parser for nested content (like list items or blockquotes).
   * Filters out block parsers that shouldn't be used in the given context.
   * @param ctx - Additional context to add to the parsing stack
   * @returns New Parser instance configured for sub-parsing
   */
  subparser(ctx?: string): Parser {
    const newContext = this.context.concat(ctx ?? []);

    const filteredBlock = this.block.filter(b => !b.excludeFromSubparse?.(newContext));

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
  private traverseAST(n: ASTNode | string, fn: (node: ASTNode) => void): void {
    if (typeof n === 'object' && n !== null) {
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
  private resolveLinks(ast: ASTNode[]): void {
    const links: Record<string, ASTNode & { type: 'link-definition' }> = {};

    ast.forEach(node =>
      this.traverseAST(node, n => {
        if (n.type === 'link-definition' && n.id) {
          links[n.id] = n;
        }
      })
    );

    ast.forEach(node =>
      this.traverseAST(node, n => {
        if (n.type === 'link' || n.type === 'image') {
          if (n.subtype === 'ref' && n.id) {
            const linkDef = links[n.id];
            if (linkDef) {
              n.href = linkDef.href;
              n.subtype = linkDef.subtype;
              n.title = linkDef.title;
              n.source = linkDef.source;
            }
          }
        }
      })
    );
  }

  /**
   * Parses inline elements within a string using the configured inline parsers.
   * Processes parsers in sequence, allowing each to handle and transform the text.
   * @param s - The string to parse for inline elements
   * @param state - Current parsing state with inline element storage
   * @param ctx - Additional context for inline parsing
   * @returns Array of AST nodes and strings representing parsed inline content
   */
  parseInlines(s: string, state?: ParserState, ctx?: string[]): (ASTNode | string)[] {
    const currentState: ParserState = state ?? {
      idx: 0,
      inlines: [],
      context: this.context
    };

    currentState.context = [...currentState.context, ...(ctx ?? [])];

    if (currentState.idx >= this.inline.length) {
      return this.resolveInlines(this.unescape(s), currentState) ?? [''];
    }

    const nextState: ParserState = {
      idx: currentState.idx + 1,
      inlines: currentState.inlines,
      context: currentState.context
    };

    const currentParser = this.inline[currentState.idx];
    if (currentParser.excludeFromSubparse?.(currentState.context)) {
      return this.parseInlines(s, nextState);
    }

    return currentParser.parse(this, s, nextState);
  }
}
