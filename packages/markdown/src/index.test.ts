import { describe, test, expect } from 'vitest';
import { parseMarkdown, markdownToHTML, markdownToPlainText } from './index';

describe('Markdown Parser', () => {
  test('should parse simple text', () => {
    const result = parseMarkdown('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('paragraph');
  });

  test('should parse headers', () => {
    const result = parseMarkdown('# Header 1\n## Header 2');
    // Filter out any empty paragraphs that might be created
    const headings = result.filter(node => node.type === 'heading');
    expect(headings).toHaveLength(2);
    expect(headings[0]!.type).toBe('heading');
    expect(headings[0]!.level).toBe(1);
    expect(headings[1]!.type).toBe('heading');
    expect(headings[1]!.level).toBe(2);
  });

  test('should convert to HTML', () => {
    const html = markdownToHTML('# Hello\n\nThis is **bold** text.');
    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>');
    expect(html).toContain('<p>');
  });

  test('should convert to plain text', () => {
    const text = markdownToPlainText('# Hello\n\nThis is **bold** text.');
    expect(text).toBe('Hello\n\nThis is bold text.');
  });

  test('should handle code blocks', () => {
    const result = parseMarkdown('```\ncode here\n```');
    expect(result[0]!.type).toBe('code');
  });

  test('should handle inline code', () => {
    const html = markdownToHTML('This is `inline code` here.');
    expect(html).toContain('<code>');
  });

  test('should handle links', () => {
    const html = markdownToHTML('[Link text](http://example.com)');
    expect(html).toContain('<a href="http://example.com">');
    expect(html).toContain('Link text');
  });

  test('should handle emphasis', () => {
    const html = markdownToHTML('This is *italic* and **bold** text.');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<strong>bold</strong>');
  });

  test('should handle small text with extended parser', () => {
    const html = markdownToHTML('-# small text', 'extended');
    expect(html).toContain('<small>small text</small>');
  });

  test('should handle small text with other paragraphs using extended parser', () => {
    const html = markdownToHTML('Normal text\n\n-# small text', 'extended');
    expect(html).toContain('<p>Normal text</p>');
    expect(html).toContain('<small>small text</small>');
  });

  test('should handle backslash line breaks', () => {
    const html = markdownToHTML('Line 1\\\nLine 2');
    expect(html).toContain('<br');
  });

  describe('table parsing', () => {
    test('parses a basic GFM table into a table node', () => {
      const result = parseMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |', 'gfm');
      expect(result[0]!.type).toBe('table');
    });

    test('produces header and body rows', () => {
      const result = parseMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |', 'gfm');
      const table = result[0]! as { type: 'table'; children: Array<{ type: string; header?: boolean; children: unknown[] }> };
      const rows = table.children;
      expect(rows[0]!.header).toBe(true);
      expect(rows[1]!.header).toBeFalsy();
    });

    test('detects column alignment', () => {
      const result = parseMarkdown('| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |', 'gfm');
      const table = result[0]! as { type: 'table'; children: Array<{ children: Array<{ align?: string }> }> };
      const headerCells = table.children[0]!.children;
      expect(headerCells[0]!.align).toBe('left');
      expect(headerCells[1]!.align).toBe('center');
      expect(headerCells[2]!.align).toBe('right');
    });

    test('renders to HTML with thead and tbody', () => {
      const html = markdownToHTML('| Name | Age |\n| --- | --- |\n| Alice | 30 |', 'gfm');
      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>');
      expect(html).toContain('<td>');
    });

    test('allows inline formatting inside cells', () => {
      const html = markdownToHTML('| **Bold** | *Italic* |\n| --- | --- |\n| x | y |', 'gfm');
      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>Italic</em>');
    });

    test('does not treat a line with pipe but no separator row as a table', () => {
      const result = parseMarkdown('some | text', 'gfm');
      expect(result[0]!.type).toBe('paragraph');
    });
  });
});
