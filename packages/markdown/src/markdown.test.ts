import { describe, test, expect } from 'vitest';
import { parseMarkdown, markdownToHTML, markdownToPlainText } from './markdown';

describe('Markdown Parser', () => {
  test('should parse simple text', () => {
    const result = parseMarkdown('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('paragraph');
  });

  test('should parse headers', () => {
    const result = parseMarkdown('# Header 1\n## Header 2');
    // Filter out any empty paragraphs that might be created
    const headings = result.filter(node => node.type === 'heading');
    expect(headings).toHaveLength(2);
    expect(headings[0].type).toBe('heading');
    expect(headings[0].level).toBe(1);
    expect(headings[1].type).toBe('heading');
    expect(headings[1].level).toBe(2);
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
    expect(result[0].type).toBe('code');
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
});
