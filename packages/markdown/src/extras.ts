import type { BlockParser, InlineParser, ASTNode, ParseState } from './types';
import { MarkdownEngine } from './markdown';
import { Parser } from './parser';

// Type definitions for the stream object used by parsers
interface StreamInterface {
  peek(): { match(re: RegExp): RegExpMatchArray | null; isEmpty(): boolean; isEOS(): boolean };
  consume(): string;
  line(): number;
  isEOS(): boolean;
}

/**
 * Macro parser for custom macro syntax like {:macroname attr="value"/} or {:macroname}content{:/}
 */
export class Macro implements BlockParser {
  private name: string;
  private fn: (attrs: Record<string, string>, body: string, parser: Parser, ast: ASTNode[]) => void;

  constructor(
    name: string,
    fn: (attrs: Record<string, string>, body: string, parser: Parser, ast: ASTNode[]) => void
  ) {
    this.name = name;
    this.fn = fn;
  }

  parse(parser: Parser, stream: StreamInterface, ast: ASTNode[]): boolean {
    const m = stream.peek().match(new RegExp('^{::' + this.name + '([^/}]*)(\\/)?' + '}$'));
    if (!m) return false;

    stream.consume();

    let body = '';
    const attrs: Record<string, string> = {};

    if (!m[2]) {
      const re = new RegExp('^{:/(' + this.name + ')?}');
      while (!stream.peek().match(re) && !stream.isEOS()) {
        body += stream.consume();
      }
      if (!stream.isEOS()) {
        stream.consume(); // consume closing tag
      }
    }

    if (m[1]) {
      const re = /([a-zA-Z]+)="([^"]+)"/g;
      let e: RegExpExecArray | null;
      while ((e = re.exec(m[1])) !== null) {
        attrs[e[1]] = e[2];
      }
    }

    this.fn(attrs, body, parser, ast);
    return true;
  }
}

/**
 * Metadata parser for YAML-style frontmatter
 */
export class Metadata implements BlockParser {
  parse(_parser: Parser, stream: StreamInterface, ast: ASTNode[]): boolean {
    const re = /^([A-Za-z-]+):\s*(.+)$/;

    if (!(stream.line() === 0 && stream.peek().match(re))) {
      return false;
    }

    let m: RegExpMatchArray | null;
    while ((m = stream.peek().match(re))) {
      ast.push({
        type: 'metadata',
        id: m[1],
        source: m[2]
      });
      stream.consume();
    }

    return true;
  }
}

/**
 * Include macro for including external content
 */
export class Include extends Macro {
  constructor(fn: (src: string) => string) {
    super('include', (attrs, _body, _parser, ast) => {
      const content = fn(attrs['src']);

      // Create a new parser instance to parse the included content
      const engine = new MarkdownEngine();
      const includedAst = engine.parser('strict').parse(content);

      // Add all parsed nodes to the current AST
      for (const node of includedAst) {
        ast.push(node);
      }
    });
  }
}

/**
 * Helper function to apply inline patterns
 */
function applyInlines(
  regex: RegExp,
  replacement: (match: RegExpMatchArray) => ASTNode,
  text: string,
  _parser: Parser,
  _state: ParseState
): (ASTNode | string)[] {
  const result: (ASTNode | string)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Add the replacement node
    result.push(replacement(match));

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
}

/**
 * Inline footnote parser
 */
export class InlineFootnote implements InlineParser {
  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    return applyInlines(
      /\[\^([^\]]+)\]/g,
      m => {
        return {
          type: 'footnote',
          subtype: 'ref',
          source: (parser as unknown as { unescape(s: string): string }).unescape(m[0]),
          id: m[1]
        };
      },
      s,
      parser,
      parserState
    );
  }
}

/**
 * Footnote definition parser
 */
export class FootnoteDefinition implements BlockParser {
  parse(parser: Parser, stream: StreamInterface, ast: ASTNode[]): boolean {
    const trimLeft = /^(\t| {0,4})/;

    const m = stream.peek().match(/!\[\^([^\]]+)\]\s?(.*)$/);
    if (!m) return false;

    stream.consume();

    const footnoteNode: ASTNode = {
      type: 'footnote-definition',
      id: (parser as unknown as { unescape(s: string): string }).unescape(m[1])
    };

    let text = m[2];
    while (!stream.isEOS() && (stream.peek().isEmpty() || stream.peek().match(trimLeft))) {
      text += '\n' + stream.consume().replace(trimLeft, '');
    }

    // Parse the footnote content as a subparser
    const engine = new MarkdownEngine();
    footnoteNode.children = engine.parser('strict').parse(text);

    ast.push(footnoteNode);
    return true;
  }

  excludeFromSubparse(): boolean {
    return true;
  }
}

/**
 * Register extras parser configuration with the default engine
 */
export function registerExtrasParser(engine: MarkdownEngine): void {
  engine.registerParser('extras', {
    parent: 'strict',
    block: [new Metadata()],
    inline: [],
    flags: {}
  });
}
