import {
  type ASTNode,
  type ASTNodeOfType,
  type BlockParser,
  InlineParser,
  type Parser,
  type ParserState
} from './parser';
import type { TokenStream } from './token-stream';
import { Util } from './utils';
import { assert } from '@diagram-craft/utils/assert';

/**
 * Handles paragraph parsing. This is the fallback parser that consumes
 * consecutive non-empty lines into a single paragraph block.
 * Must be added last to the block parser list.
 */
export class ParagraphHandler implements BlockParser {
  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    let s = '';
    const paragraphAstNode: ASTNode = { type: 'paragraph' };
    ast.push(paragraphAstNode);

    while (!stream.peek().isEmpty()) {
      if (s.length > 0) {
        for (const blockParser of parser.block) {
          if (blockParser === this) continue;
          if (blockParser.parse(parser, stream, ast)) {
            paragraphAstNode.children = parser.parseInlines(s.slice(0, -1), undefined, [
              'paragraph'
            ]);
            return true;
          }
        }
      }

      s += stream.consume().text?.replace(/^\s+/, '') ?? '';
      if (!stream.peek().isEmpty()) s += '\n';
    }

    paragraphAstNode.children = parser.parseInlines(s, undefined, ['paragraph']);
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
      children: parser.parseInlines(text, undefined, ['setext-header'])
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

    assert.true(m.length >= 3, 'Invalid ATX header');

    ast.push({
      type: 'heading',
      level: m[1]!.length,
      children: parser.parseInlines(m[2]!, undefined, ['atx-header'])
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
  private readonly re = /^(?: {0,3})?>(?: |$)?(.*)/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(this.re);
    if (!m) return false;

    let s = '';
    while (!stream.peek().isEmpty()) {
      const lineMatch = stream.peek().match(this.re);
      if (lineMatch) {
        s += lineMatch[1];
      } else {
        s += stream.peek().text?.trim() ?? '';
      }
      s += '\n';
      stream.consume();
    }

    const lastASTNode = ast.at(-1);
    const lastASTNodeIsBlockquote = lastASTNode?.type === 'blockquote';

    if (lastASTNodeIsBlockquote && lastASTNode.children) {
      const newChildren = parser.subparser().parse(s);
      lastASTNode.children = [...lastASTNode.children, ...newChildren];
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
  private re = /^(?:\t|    )(.*)/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    const m = stream.peek().match(this.re);
    if (!m || !stream.peek(-1).isEmpty()) return false;

    let s = '';
    let lineMatch: RegExpMatchArray | null = m;

    do {
      if (stream.peek().isEmpty()) {
        if (!stream.peek(1).match(this.re)) break;
      } else {
        s += lineMatch![1];
      }
      s += '\n';

      stream.consume();
      lineMatch = stream.peek().match(this.re);
    } while (lineMatch || stream.peek().isEmpty());

    ast.push({
      type: 'code',
      children: [
        {
          type: 'literal',
          value: parser.unescape(s)
        }
      ]
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

    const fence = m[1]!;
    const language = m[2]?.trim() || '';
    stream.consume(); // consume opening fence

    let code = '';
    while (!stream.peek().isEmpty()) {
      const line = stream.peek();
      if (line.match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`))) {
        stream.consume(); // consume closing fence
        break;
      }
      code += `${line.text ?? ''}\n`;
      stream.consume();
    }

    // Remove trailing newline if present
    if (code.endsWith('\n')) {
      code = code.slice(0, -1);
    }

    ast.push({
      type: 'code',
      children: [{ type: 'literal', value: code }],
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

    const l = m[1]!.length;
    const rS = new RegExp(`^( {${l}})([*+-]|[0-9]+\\.) (.*)`);
    const rC = new RegExp(`^( {${parseInt(l.toString(), 10) + 1}}|\\t)`);

    let s = '';
    let containsEmpty = false;
    const type = m[2]!.match(/[*+-]/) ? 'unordered' : 'ordered';
    const items: Array<ASTNodeOfType<'item'>> = [];
    let lineMatch: RegExpMatchArray | null = m;

    while (true) {
      const current = stream.peek();
      const next = stream.peek(1);

      const itemCompleted =
        s.trim() !== '' && (lineMatch || (current.isEmpty() && !next.match(rC)));

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
        s += lineMatch[3]!.replace(this.trimLeft, '');
      } else {
        s += `\n${current.text?.replace(this.trimLeft, '') ?? ''}`;
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
      items[items.length - 1]!.followedByEmpty = false;
    }

    // Item is loose if it contains an empty line or is followed by an empty line
    for (let i = 0; i < items.length; i++) {
      items[i]!.loose = !!(items[i]!.containsEmpty || items[i]!.followedByEmpty);
    }

    // Items on both sides of empty line is considered "loose"
    for (let i = items.length - 1; i > 0; i--) {
      items[i]!.loose = items[i]!.loose || !!items[i - 1]!.followedByEmpty;
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
export class InlineCodeHandler extends InlineParser {
  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    return this.applyInlineRegExp(parser, parserState, s, /(`+)( ?)(.+?)\2\1/g, m => ({
      type: 'code',
      inline: true,
      children: parser.parseInlines(m[3]!, parserState, ['code'])
    }));
  }
}

/**
 * Handles emphasis and strong emphasis using * or _ characters.
 * This is somewhat complicated in order to handle nested emphasis correctly.
 */
export class InlineEmphasisHandler extends InlineParser {
  constructor(private sym: string) {
    super();
  }

  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    const LENGTHS = { e: 1, s: 2 };

    // Count mark occurrences
    let markCount = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === this.sym) markCount++;
    }

    if (markCount < 2) {
      return parser.parseInlines(s, parserState);
    }

    interface ParseState {
      tag: string;
      arr: MarkingOperation[];
    }

    interface MarkingOperation {
      op: number; // 1 = open, 0 = close
      type: string; // 'e' = emphasis, 's' = strong
      idx: number;
    }

    interface ParseResult {
      score: number;
      markings: MarkingOperation[];
    }

    const parseMarkings = (i: number = 0, state?: ParseState, p: number = 0): ParseResult[] => {
      if (!state) state = { tag: '', arr: [] };

      const open = (t: string): ParseState => ({
        tag: `${state.tag}/${t}`,
        arr: state.arr.concat([{ op: 1, type: t, idx: i }])
      });

      const close = (t: string): ParseState => ({
        tag: state.tag.slice(0, -2),
        arr: state.arr.concat([{ op: 0, type: t, idx: i }])
      });

      const dest: (ParseResult | undefined)[] = [];

      if (i >= s.length) {
        return state.tag === '' ? [{ score: p, markings: state.arr }] : [];
      } else if (s[i] === this.sym) {
        // Calculate distance from open tag to not allow empty strong/em tags
        let dis = 0;
        const last = state.arr.length > 0 ? state.arr[state.arr.length - 1] : undefined;
        if (last) dis = i - last.idx - LENGTHS[last.type as keyof typeof LENGTHS];

        if (i + 1 < s.length && s[i + 1] === this.sym) {
          // Two consecutive symbols (**)

          // <strong> if not in <strong>
          if (state.tag === '' || state.tag === '/e')
            dest.push(...parseMarkings(i + LENGTHS['s'], open('s'), p));

          // </strong> if in <strong>
          if ((state.tag === '/s' || state.tag === '/e/s') && dis > 0)
            dest.push(...parseMarkings(i + LENGTHS['s'], close('s'), p));

          // </em> if in <em>
          if ((state.tag === '/e' || state.tag === '/s/e') && dis > 0)
            dest.push(...parseMarkings(i + LENGTHS['e'], close('e'), p));

          // <em> if not in <em>
          if (state.tag === '' || state.tag === '/s')
            dest.push(...parseMarkings(i + LENGTHS['e'], open('e'), p));

          // literal *
          dest.push(...parseMarkings(i + 1, state, p + 10));
        } else {
          // Single symbol (*)

          // </em> if in <em>
          if ((state.tag === '/e' || state.tag === '/s/e') && dis > 0)
            dest.push(...parseMarkings(i + LENGTHS['e'], close('e'), p));

          // <em> if not in <em>
          if (state.tag === '' || state.tag === '/s')
            dest.push(...parseMarkings(i + LENGTHS['e'], open('e'), p));

          // literal *
          dest.push(...parseMarkings(i + 1, state, p + 10));
        }
      } else {
        // Skip to next symbol
        let nextI = i;
        do {
          nextI++;
        } while (nextI < s.length && s[nextI] !== this.sym);
        dest.push(...parseMarkings(nextI, state, p));
      }

      return dest.filter((o): o is ParseResult => o !== undefined);
    };

    const allResults = parseMarkings(0);
    if (allResults.length === 0) {
      return parser.parseInlines(s, parserState);
    }

    const markings = allResults.sort((a, b) => a.score - b.score)[0]!.markings;
    const outer: MarkingOperation[] = [];

    // Filter out only outer markings
    for (let i = 0; i < markings.length; i++) {
      if (outer.length === 0 || markings[i]!.type === outer[0]!.type) {
        outer.push(markings[i]!);
      }
    }

    if (outer.length === 0) {
      return parser.parseInlines(s, parserState);
    }

    const l = LENGTHS[outer[0]!.type as keyof typeof LENGTHS];
    const type = outer[0]!.type === 'e' ? 'emphasis' : 'strong';
    let dest = '';
    let lastIndex = 0;

    for (let i = 0; i < outer.length - 1; i++) {
      if (outer[i]!.idx > lastIndex) {
        dest += s.substring(lastIndex, outer[i]!.idx);
      }

      lastIndex = outer[i + 1]!.idx;
      if (outer[i]!.op === 1) {
        dest += parser.addInline(parserState, {
          type: type,
          children: parser.parseInlines(s.substring(outer[i]!.idx + l, lastIndex), parserState, [
            type
          ])
        });
      }
    }

    if (lastIndex > 0) {
      if (lastIndex + l < s.length) {
        dest += s.slice(lastIndex + l);
      }
    } else {
      dest += s.slice(l);
    }

    return parser.parseInlines(dest, parserState);
  }
}

/**
 * Handles inline links and images in the format [text](url "title").
 * Can handle both links and images depending on constructor parameter.
 * Uses balanced bracket matching to handle nested brackets correctly.
 */
export class InlineLinkHandler extends InlineParser {
  constructor(private type: 'link' | 'image') {
    super();
  }

  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    const textSegStartsAt = this.type === 'image' ? 1 : 0;
    const prefix = this.type === 'image' ? '!' : '';

    // Use simpler regex to find potential starts, then use balanced bracket matching
    const regex =
      this.type === 'image'
        ? /!\[([^\]*]+)\]\(([^)"]+)( +"([^"]+)")?\).*/g
        : /\[([^\]*]+)\]\(([^)"]+)( +"([^"]+)")?\).*/g;

    return this.applyInlineRegExp(parser, parserState, s, regex, (m, progress) => {
      // Find balanced brackets for the text segment
      const textSeg =
        prefix + Util.findBalancedSubstring(m[0].substring(textSegStartsAt), '[', ']');
      if (!textSeg) {
        return null; // Invalid bracket structure
      }

      const remainder = m[0].substring(textSeg.length);
      const closingParenIndex = remainder.indexOf(')');
      if (closingParenIndex === -1) {
        return null; // No closing parenthesis
      }

      const hrefSeg = remainder.substring(0, closingParenIndex + 1);
      progress?.(textSeg.length + hrefSeg.length);

      const hrefMatch = hrefSeg.match(/\(([^)"]+)( +"([^"]+)")?\)/);
      if (!hrefMatch) {
        return null; // Invalid href format
      }

      const obj: ASTNode = {
        type: this.type,
        source: textSeg + hrefSeg,
        href: parser.unescape(hrefMatch[1]!),
        children: parser.parseInlines(
          textSeg.slice(this.type === 'image' ? 2 : 1, -1),
          parserState,
          [this.type]
        )
      };

      if (hrefMatch[3]) {
        obj.title = parser.unescape(hrefMatch[3]);
      }

      return obj;
    });
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

    const obj: ASTNodeOfType<'link-definition'> = {
      type: 'link-definition',
      id: parser.unescape(m[1]!),
      href: parser.unescape(m[2]!)
    };

    if (m[4]) {
      obj.title = parser.unescape(m[4]);
    } else {
      const nextMatch = stream.peek().match(/\s+["(']([^\\]+)[")']/);
      if (nextMatch) {
        obj.title = nextMatch[1];
        stream.consume();
      }
    }

    ast.push(obj);
    return true;
  }

  excludeFromSubparse() {
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

    const re = new RegExp(`^<${tagName} */>`);
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
      dest += `${stream.consume().text ?? ''}\n`;
    }

    dest += `${stream.consume().text ?? ''}\n`;

    ast.push({ type: 'html', subtype: 'comment', html: dest });
    return true;
  }
}

/**
 * Handles reference-style links and images.
 * Example: [text][ref] or ![alt][ref]
 */
export class InlineRefImageAndLinkHandler extends InlineParser {
  constructor(private type: 'link' | 'image') {
    super();
  }

  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    const regex =
      this.type === 'image'
        ? /!\[([^\]*]+)\]\s?(\[([^\]]*)\])?/g
        : /\[([^\]*]+)\]\s?(\[([^\]]*)\])?/g;

    return this.applyInlineRegExp(parser, parserState, s, regex, m => {
      return {
        type: this.type,
        subtype: 'ref',
        source: parser.unescape(m[0]),
        children: parser.parseInlines(m[1]!, parserState, [`${this.type}-ref`]),
        id: m[3] && m[3].length > 0 ? parser.unescape(m[3]) : parser.unescape(m[1]!)
      };
    });
  }
}

/**
 * Handles automatic links.
 * Example: <http://example.com> or <email@example.com>
 */
export class InlineAutolinksHandler extends InlineParser {
  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    return this.applyInlineRegExp(
      parser,
      parserState,
      s,
      /<(((https?|ftp|mailto):[^'">\s]+)|([a-zA-Z]+@[a-zA-Z.]+))>/g,
      m => {
        return {
          type: 'link',
          children: [{ type: 'literal', value: m[1]! }],
          href: m[1]!.match(/[a-zA-Z]+@[a-zA-Z.]+/) ? `mailto:${m[1]}` : m[1]
        };
      }
    );
  }
}

/**
 * Handles line breaks (two spaces at end of line or backslash).
 * Example: "line  \n" or "line\\\n"
 */
export class InlineLineBreakHandler extends InlineParser {
  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    const context =
      parserState.context.includes('atx-header') || parserState.context.includes('setext-header');

    if (context) {
      s = s.replace(/ +$/gm, '');
    } else {
      s = s.replace(/  +$/gm, () => {
        return parser.addInline(parserState, { type: 'line-break' });
      });
      s = s.replace(/ *\\$/gm, () => {
        return parser.addInline(parserState, { type: 'line-break' });
      });
    }

    s = s.replace(/\t$/gm, '    ');
    return parser.parseInlines(s, parserState);
  }
}
