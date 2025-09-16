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

export interface ParseState {
  idx: number;
  inlines: ASTNode[];
  context: string[];
}

export interface MatchResult {
  text: string | null;
  match(re: RegExp): RegExpMatchArray | null;
  isEmpty(): boolean;
  isEOS(): boolean;
}

export interface ParserConfiguration {
  flags?: Record<string, unknown>;
  inline?: InlineParser[];
  block?: BlockParser[];
  parent?: string;
}

export interface BlockParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(parser: any, stream: any, ast: ASTNode[]): boolean;
  excludeFromSubparse?(context: string[]): boolean;
}

export interface InlineParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(parser: any, s: string, parserState: ParseState): (ASTNode | string)[];
  excludeFromSubparse?(context: string[]): boolean;
}

export type ParserType = 'strict' | string;