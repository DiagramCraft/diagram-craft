import type { ASTNode, ParseState, BlockParser, InlineParser } from './types';
import type { Parser } from './parser';
import type { TokenStream } from './token-stream';
import { Util } from './utils';

/**
 * Handles paragraph parsing. This is the fallback parser that consumes
 * consecutive non-empty lines into a single paragraph block.
 * Must be added last to the block parser list.
 */
export class ParagraphHandler implements BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    let s = '';
    const obj: ASTNode = { type: 'paragraph' };
    ast.push(obj);

    while (!stream.peek().isEmpty()) {
      if (s.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const blockParser of (parser as any).block) {
          if (blockParser === this) continue;
          if (blockParser.parse(parser, stream, ast)) {
            obj.children = parser.parseInlines(s.slice(0, -1), undefined, 'paragraph');
            return true;
          }
        }
      }

      s += stream.consume().text?.replace(/^\s+/, '') ?? '';
      if (!stream.peek().isEmpty()) s += '\n';
    }

    obj.children = parser.parseInlines(s, undefined, 'paragraph');
    return true;
  }
}

/**
 * Handles setext-style headers (underlined with = or -).
 * Example: "Header\n=====" or "Header\n-----"
 */
export class SetextHeaderHandler implements BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek(1).match(/^(?:-+|=+)$/);
    if (!m) return false;

    const text = stream.peek().text ?? '';
    ast.push({
      type: 'heading',
      level: m[0][0] === '=' ? 1 : 2,
      children: parser.parseInlines(text, undefined, 'setext-header')
    });
    stream.consume(1);
    return true;
  }

  excludeFromSubparse(ctx: string[]): boolean {
    return ctx.includes('list');
  }
}

/**
 * Handles ATX-style headers (prefixed with #).
 * Example: "# Header 1", "## Header 2", etc.
 */
export class AtxHeaderHandler implements BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^(#+)\s+((\S|[^#])+?)(?:\s?#+)?$/);
    if (!m) return false;

    ast.push({
      type: 'heading',
      level: m[1].length,
      children: parser.parseInlines(m[2], undefined, 'atx-header')
    });
    stream.consume();
    return true;
  }

  excludeFromSubparse(ctx: string[]): boolean {
    return ctx.includes('list');
  }
}

/**
 * Handles blockquote parsing. Blockquotes start with > and can be nested.
 * Consecutive blockquotes are merged into a single blockquote element.
 */
export class BlockquoteHandler implements BlockParser {
  private rS = /^(?: {0,3})?>(?: |$)?(.*)/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(this.rS);
    if (!m) return false;

    let s = '';
    while (!stream.peek().isEmpty()) {
      const lineMatch = stream.peek().match(this.rS);
      if (lineMatch) {
        s += lineMatch[1];
      } else {
        s += stream.peek().text?.trim() ?? '';
      }
      s += '\n';
      stream.consume();
    }

    const lastASTNode = ast.length > 0 ? ast[ast.length - 1] : null;
    const lastASTNodeIsBlockquote = lastASTNode?.type === 'blockquote';

    if (lastASTNodeIsBlockquote && lastASTNode.children) {
      const newChildren = parser.subparser().parse(s);
      lastASTNode.children = lastASTNode.children.concat(newChildren);
    } else {
      ast.push({
        type: 'blockquote',
        children: parser.subparser('blockquote').parse(s)
      });
    }

    return true;
  }
}

/**
 * Handles indented code blocks. Code blocks are lines indented with
 * at least 4 spaces or 1 tab character.
 */
export class CodeHandler implements BlockParser {
  // eslint-disable-next-line no-regex-spaces
  private rS = /^(?:\t|    )(.*)/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(this.rS);
    if (!m || !stream.peek(-1).isEmpty()) return false;

    let s = '';
    let lineMatch: RegExpMatchArray | null = m;

    do {
      if (stream.peek().isEmpty()) {
        if (!stream.peek(1).match(this.rS)) break;
      } else {
        s += lineMatch![1];
      }
      s += '\n';

      stream.consume();
      lineMatch = stream.peek().match(this.rS);
    } while (lineMatch || stream.peek().isEmpty());

    ast.push({
      type: 'code',
      children: [parser.unescape(s) as string]
    });
    return true;
  }
}

/**
 * Handles fenced code blocks. Code blocks are surrounded by ``` or ~~~.
 * Example: ```\ncode here\n```
 */
export class FencedCodeHandler implements BlockParser {
  parse(_parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^(`{3,}|~{3,})(.*)?$/);
    if (!m) return false;

    const fence = m[1];
    const language = m[2]?.trim() || '';
    stream.consume(); // consume opening fence

    let code = '';
    while (!stream.peek().isEmpty()) {
      const line = stream.peek();
      if (line.match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`))) {
        stream.consume(); // consume closing fence
        break;
      }
      code += (line.text ?? '') + '\n';
      stream.consume();
    }

    // Remove trailing newline if present
    if (code.endsWith('\n')) {
      code = code.slice(0, -1);
    }

    ast.push({
      type: 'code',
      children: [code],
      source: language,
      inline: false
    });

    return true;
  }
}

/**
 * Handles both ordered and unordered lists. This is one of the most complex
 * parsers as it needs to handle nested content, loose/tight list items,
 * and various indentation patterns.
 */
export class ListHandler implements BlockParser {
  private trimLeft = /^(\t| {0,4})/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^( {0,3})([*+-](?!\s?[*+-])|[0-9]+\.) (.*)/);
    if (!m) return false;

    const l = m[1].length;
    const rS = new RegExp(`^( {${l}})([*+-]|[0-9]+\\.) (.*)`);
    const rC = new RegExp(`^( {${parseInt(l.toString()) + 1}}|\\t)`);

    let s = '';
    let containsEmpty = false;
    const type = m[2].match(/[*+-]/) ? 'unordered' : 'ordered';
    const items: ASTNode[] = [];
    let lineMatch: RegExpMatchArray | null = m;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = stream.peek();
      const next = stream.peek(1);

      const itemCompleted = s.trim() !== '' && (
        lineMatch ||
        (current.isEmpty() && !next.match(rC))
      );

      if (itemCompleted) {
        const parsedContent = parser.subparser('list').parse(s);
        items.push({
          type: 'item',
          children: parsedContent,
          containsEmpty,
          followedByEmpty: current.isEmpty()
        });
        s = '';
        containsEmpty = false;
      }

      if (current.isEmpty()) {
        if (!next.match(rS) && !next.match(rC)) break;
        s += '\n';
        containsEmpty = true;
      } else if (lineMatch) {
        s += lineMatch[3].replace(this.trimLeft, '');
      } else {
        s += '\n' + (current.text?.replace(this.trimLeft, '') ?? '');
      }

      stream.consume();
      lineMatch = stream.peek().match(rS);
    }

    // Process final item if there's content
    if (s.trim() !== '') {
      const parsedContent = parser.subparser('list').parse(s);
      items.push({
        type: 'item',
        children: parsedContent,
        containsEmpty,
        followedByEmpty: false
      });
    }

    // Ignore followed by empty for last row
    if (items.length > 0) {
      items[items.length - 1].followedByEmpty = false;
    }

    // Item is loose if it contains an empty line or is followed by an empty line
    for (let i = 0; i < items.length; i++) {
      items[i].loose = !!(items[i].containsEmpty || items[i].followedByEmpty);
    }

    // Items on both sides of empty line is considered "loose"
    for (let i = items.length - 1; i > 0; i--) {
      items[i].loose = items[i].loose || !!items[i - 1].followedByEmpty;
    }

    // If not loose, lift contents of first child, if paragraph, and replace first element
    for (const item of items) {
      if (item.loose) continue;
      if (!item.children?.[0] || typeof item.children[0] === 'string') continue;
      if (item.children[0].type !== 'paragraph') continue;

      const paragraphChildren = item.children[0].children;
      if (paragraphChildren) {
        item.children.splice(0, 1, ...paragraphChildren);
      }
    }

    // Clean temporary loose state
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (item as any).loose;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (item as any).followedByEmpty;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (item as any).containsEmpty;
    }

    ast.push({
      type: 'list',
      subtype: type,
      children: items
    });
    return true;
  }
}

/**
 * Handles inline code spans marked with backticks.
 * Example: `code here` or ``code with `backticks` ``
 */
export class InlineCodeHandler implements InlineParser {
  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    return this.applyInlines(
      /(`+)( ?)(.+?)\2\1/g,
      m => {
        return {
          type: 'code',
          inline: true,
          children: parser.parseInlines(m[3], parserState, 'code')
        };
      },
      s,
      parser,
      parserState
    );
  }

  private applyInlines(
    re: RegExp,
    fn: (match: RegExpExecArray) => ASTNode,
    s: string,
    parser: Parser,
    parserState: ParseState
  ): (ASTNode | string)[] {
    let dest = '';
    Util.iterateRegex(re, s, m => {
      if (typeof m === 'string') {
        dest += m;
      } else {
        dest += parser.markParsedInline(parserState, fn(m));
      }
    });

    return parser.parseInlines(dest, parserState);
  }
}

/**
 * Handles emphasis and strong emphasis using * or _ characters.
 * This is a simplified implementation - the full CommonMark spec is quite complex.
 */
export class InlineEmphasisHandler implements InlineParser {
  constructor(private sym: string) {}

  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    const markCount = s.split(this.sym).length - 1;

    if (markCount < 2) {
      return parser.parseInlines(s, parserState);
    }

    // Simplified emphasis parsing - this is a complex algorithm in the original
    // For now, just handle basic cases
    let result = s;

    // Handle strong (**text**)
    result = result.replace(
      new RegExp(`\\${this.sym}\\${this.sym}([^\\${this.sym}]+)\\${this.sym}\\${this.sym}`, 'g'),
      (_match, content) => {
        return parser.markParsedInline(parserState, {
          type: 'strong',
          children: parser.parseInlines(content, parserState, 'strong')
        });
      }
    );

    // Handle emphasis (*text*)
    result = result.replace(
      new RegExp(`\\${this.sym}([^\\${this.sym}]+)\\${this.sym}`, 'g'),
      (_match, content) => {
        return parser.markParsedInline(parserState, {
          type: 'emphasis',
          children: parser.parseInlines(content, parserState, 'emphasis')
        });
      }
    );

    return parser.parseInlines(result, parserState);
  }
}

/**
 * Handles inline links and images in the format [text](url "title").
 * Can handle both links and images depending on constructor parameter.
 */
export class InlineLinkHandler implements InlineParser {
  constructor(private type: 'link' | 'image') {}

  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    const regex =
      this.type === 'image'
        ? /!\[([^\]*]+)\]\(([^)"]+)( +"([^"]+)")?\)/g
        : /\[([^\]*]+)\]\(([^)"]+)( +"([^"]+)")?\)/g;

    return this.applyInlines(
      regex,
      m => {
        const obj: ASTNode = {
          type: this.type,
          source: m[0],
          href: parser.unescape(m[2]) as string,
          children: parser.parseInlines(m[1], parserState, this.type)
        };
        if (m[4]) obj.title = parser.unescape(m[4]) as string;
        return obj;
      },
      s,
      parser,
      parserState
    );
  }

  private applyInlines(
    re: RegExp,
    fn: (match: RegExpExecArray) => ASTNode,
    s: string,
    parser: Parser,
    parserState: ParseState
  ): (ASTNode | string)[] {
    let dest = '';
    Util.iterateRegex(re, s, m => {
      if (typeof m === 'string') {
        dest += m;
      } else {
        dest += parser.markParsedInline(parserState, fn(m));
      }
    });

    return parser.parseInlines(dest, parserState);
  }
}

/**
 * Handles reference link definitions.
 * Example: [link id]: http://example.com "title"
 */
export class ReferenceLinkDefinitionHandler implements BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^\[(.+)\]:\s*<?([^" >]*)>?( +["(']([^")]+)[")'])?$/);
    if (!m) return false;

    stream.consume();

    const obj: ASTNode = {
      type: 'link-definition',
      id: parser.unescape(m[1]) as string,
      href: parser.unescape(m[2]) as string
    };

    if (m[4]) {
      obj.title = parser.unescape(m[4]) as string;
    } else {
      const nextMatch = stream.peek().match(/\s+["(']([^]+)[")']/);
      if (nextMatch) {
        obj.title = nextMatch[1];
        stream.consume();
      }
    }

    ast.push(obj);
    return true;
  }

  excludeFromSubparse(): boolean {
    return true;
  }
}

/**
 * Handles horizontal rulers (hr tags).
 * Example: *** or --- or ___
 */
export class HorizontalRulerHandler implements BlockParser {
  parse(_parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^ *[*_-]+( *[*_-])+$/);
    if (!m) return false;

    ast.push({ type: 'hr' });
    stream.consume();
    return true;
  }
}

/**
 * Handles HTML blocks.
 * Example: <div>content</div>
 */
export class HtmlHandler implements BlockParser {
  parse(_parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^<([a-z]+)$/);
    if (!m) return false;

    const tagName = m[1];
    let dest = '';

    const re = new RegExp('^<' + tagName + ' */>');
    while (!stream.peek().match(re)) {
      dest += stream.consume().text ?? '';
    }

    dest += stream.consume().text ?? '';

    ast.push({ type: 'html', html: dest });
    return true;
  }
}

/**
 * Handles HTML comments.
 * Example: <!-- comment -->
 */
export class CommentHandler implements BlockParser {
  parse(_parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(/^<!--$/);
    if (!m) return false;

    let dest = '';

    while (!stream.peek().match(/^-->/)) {
      dest += (stream.consume().text ?? '') + '\n';
    }

    dest += (stream.consume().text ?? '') + '\n';

    ast.push({ type: 'html', subtype: 'comment', html: dest });
    return true;
  }
}

/**
 * Handles reference-style links and images.
 * Example: [text][ref] or ![alt][ref]
 */
export class InlineRefImageAndLinkHandler implements InlineParser {
  constructor(private type: 'link' | 'image') {}

  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    const regex =
      this.type === 'image'
        ? /!\[([^\]*]+)\]\s?(\[([^\]]*)\])?/g
        : /\[([^\]*]+)\]\s?(\[([^\]]*)\])?/g;

    return this.applyInlines(
      regex,
      m => {
        return {
          type: this.type,
          subtype: 'ref',
          source: parser.unescape(m[0]) as string,
          children: parser.parseInlines(m[1], parserState, this.type + '-ref'),
          id:
            m[3] && m[3].length > 0
              ? (parser.unescape(m[3]) as string)
              : (parser.unescape(m[1]) as string)
        };
      },
      s,
      parser,
      parserState
    );
  }

  private applyInlines(
    re: RegExp,
    fn: (match: RegExpExecArray) => ASTNode,
    s: string,
    parser: Parser,
    parserState: ParseState
  ): (ASTNode | string)[] {
    let dest = '';
    Util.iterateRegex(re, s, m => {
      if (typeof m === 'string') {
        dest += m;
      } else {
        dest += parser.markParsedInline(parserState, fn(m));
      }
    });

    return parser.parseInlines(dest, parserState);
  }
}

/**
 * Handles automatic links.
 * Example: <http://example.com> or <email@example.com>
 */
export class InlineAutolinksHandler implements InlineParser {
  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    return this.applyInlines(
      /<(((https?|ftp|mailto):[^'">\s]+)|([a-zA-Z]+@[a-zA-Z.]+))>/g,
      m => {
        return {
          type: 'link',
          children: [m[1]],
          href: m[1].match(/[a-zA-Z]+@[a-zA-Z.]+/) ? 'mailto:' + m[1] : m[1]
        };
      },
      s,
      parser,
      parserState
    );
  }

  private applyInlines(
    re: RegExp,
    fn: (match: RegExpExecArray) => ASTNode,
    s: string,
    parser: Parser,
    parserState: ParseState
  ): (ASTNode | string)[] {
    let dest = '';
    Util.iterateRegex(re, s, m => {
      if (typeof m === 'string') {
        dest += m;
      } else {
        dest += parser.markParsedInline(parserState, fn(m));
      }
    });

    return parser.parseInlines(dest, parserState);
  }
}

/**
 * Handles line breaks (two spaces at end of line or backslash).
 * Example: "line  \n" or "line\\\n"
 */
export class InlineLineBreakHandler implements InlineParser {
  parse(parser: Parser, s: string, parserState: ParseState): (ASTNode | string)[] {
    const context =
      parserState.context?.includes('atx-header') || parserState.context?.includes('setext-header');

    if (context) {
      s = s.replace(/ +$/gm, '');
    } else {
      s = s.replace(/  +$/gm, () => {
        return parser.markParsedInline(parserState, { type: 'line-break' });
      });
      s = s.replace(/ *\\$/gm, () => {
        return parser.markParsedInline(parserState, { type: 'line-break' });
      });
    }

    s = s.replace(/\t$/g, '    ');
    return parser.parseInlines(s, parserState);
  }
}
