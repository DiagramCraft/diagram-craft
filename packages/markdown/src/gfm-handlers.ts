import {
  type ASTNode,
  type BlockParser,
  InlineParser,
  type Parser,
  type ParserState
} from './parser';
import type { TokenStream } from './token-stream';

export class InlineStrikethroughHandler extends InlineParser {
  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    return this.applyInlineRegExp(parser, parserState, s, /~~(?=\S)([\s\S]*?\S)~~/g, match => ({
      type: 'strikethrough',
      children: parser.parseInlines(match[1]!, parserState, ['strikethrough'])
    }));
  }
}

const parseTableCells = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
};

const parseAlignments = (sep: string): Array<'left' | 'center' | 'right' | undefined> => {
  return parseTableCells(sep).map(cell => {
    const c = cell.trim();
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.startsWith(':')) return 'left';
    if (c.endsWith(':')) return 'right';
    return undefined;
  });
};

export class TableHandler implements BlockParser {
  private rowRe = /^\|(.+)/;
  private sepRe = /^\|[\s|:-]+\|?\s*$/;

  parse(parser: Parser, stream: TokenStream, ast: ASTNode[]): boolean {
    if (!stream.peek().match(this.rowRe)) return false;
    if (!stream.peek(1).match(this.sepRe)) return false;

    const headerLine = stream.consume().text ?? '';
    const headerCells = parseTableCells(headerLine);

    const sepLine = stream.consume().text ?? '';
    const alignments = parseAlignments(sepLine);

    const headerRow: ASTNode = {
      type: 'table-row',
      header: true,
      children: headerCells.map((cell, i) => ({
        type: 'table-cell' as const,
        align: alignments[i],
        header: true,
        children: parser.parseInlines(cell)
      }))
    };

    const dataRows: ASTNode[] = [];
    while (!stream.isEOS() && stream.peek().match(this.rowRe)) {
      const line = stream.consume().text ?? '';
      const cells = parseTableCells(line);
      dataRows.push({
        type: 'table-row',
        children: cells.map((cell, i) => ({
          type: 'table-cell' as const,
          align: alignments[i],
          children: parser.parseInlines(cell)
        }))
      });
    }

    ast.push({ type: 'table', children: [headerRow, ...dataRows] });
    return true;
  }
}
