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
export interface ParseState {
  idx: number;
  inlines: ASTNode[];
  context: string[];
}

/**
 * Represents a line from the token stream with utility methods for matching.
 */
export interface MatchResult {
  text: string | null;
  match(re: RegExp): RegExpMatchArray | null;
  isEmpty(): boolean;
  isEOS(): boolean;
}

/**
 * Configuration object for creating markdown parsers.
 * Defines which block and inline parsers to use, along with flags and inheritance.
 */
export interface ParserConfiguration {
  flags?: Record<string, unknown>;
  inline?: InlineParser[];
  block?: BlockParser[];
  parent?: string;
}

/**
 * Interface for block-level markdown parsers (headers, paragraphs, lists, etc.).
 */
export interface BlockParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(parser: any, stream: any, ast: ASTNode[]): boolean;
  excludeFromSubparse?(context: string[]): boolean;
}

/**
 * Interface for inline markdown parsers (emphasis, links, code spans, etc.).
 */
export interface InlineParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(parser: any, s: string, parserState: ParseState): (ASTNode | string)[];
  excludeFromSubparse?(context: string[]): boolean;
}

/**
 * Valid parser type identifiers. 'strict' is the default implementation.
 */
export type ParserType = 'strict' | string;