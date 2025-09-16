import type { ASTNode, ParseState, BlockParser, InlineParser } from './types';
import { TokenStream } from './token-stream';

export class Parser {
  private block: BlockParser[];
  private inline: InlineParser[];
  private flags: Record<string, unknown>;
  private context: string[];
  private escapes = ["\\`*_{}[]()+-.!#", "abcdefghijklmno"];

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

  escape(s: string): string {
    return s.replace(/\\[\\`*_{}[\]()+-.!#]/g, (c) => {
      return "\x1b" + this.escapes[1][this.escapes[0].indexOf(c[1])];
    });
  }

  unescape(s: string | undefined, state?: ParseState): (ASTNode | string)[] | string | undefined {
    if (s === undefined) return undefined;

    // eslint-disable-next-line no-control-regex
    s = s.replace(/\x1b[a-o]/g, (c) => {
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

  markParsedInline(parserState: ParseState, obj: ASTNode): string {
    return "\x1bq" + (parserState.inlines.push(obj) - 1) + "q";
  }

  subparser(ctx?: string | string[]): Parser {
    const newContext = this.context.concat(Array.isArray(ctx) ? ctx : ctx ? [ctx] : []);

    const filteredBlock = this.block.filter(b =>
      !(b.excludeFromSubparse && b.excludeFromSubparse(newContext))
    );

    return new Parser(filteredBlock, this.inline, this.flags, newContext);
  }

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

  resolveLinks(ast: ASTNode[]): void {
    const links: Record<string, ASTNode> = {};

    this.traverseAST(ast, (n) => {
      if (n.type === "link-definition" && n.id) {
        links[n.id] = n;
      }
    });

    this.traverseAST(ast, (n) => {
      if (n.subtype === 'ref' && n.id) {
        const linkDef = links[n.id];
        if (linkDef) {
          Object.assign(n, linkDef);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (n as any).type; // Will be set by the original node type
        }
      }
    });
  }

  parseInlines(s: string, state?: ParseState, ctx?: string | string[]): (ASTNode | string)[] {
    const currentState: ParseState = state ?? {
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

    const nextState: ParseState = {
      idx: currentState.idx + 1,
      inlines: currentState.inlines,
      context: currentState.context
    };

    const currentParser = this.inline[currentState.idx];
    if (currentParser.excludeFromSubparse && currentParser.excludeFromSubparse(currentState.context)) {
      return this.parseInlines(s, nextState);
    }

    return currentParser.parse(this, s, nextState);
  }
}