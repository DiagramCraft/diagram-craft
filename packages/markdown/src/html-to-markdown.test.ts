import { describe, test, expect, beforeEach } from 'vitest';
import { HTMLToMarkdownConverter, htmlToMarkdown } from './html-to-markdown';
import { JSDOM } from 'jsdom';

describe('HTMLToMarkdownConverter', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM();
    document = dom.window.document;
    global.Node = dom.window.Node;
  });

  describe('headings', () => {
    test('converts h1 to markdown', () => {
      const div = document.createElement('div');
      div.innerHTML = '<h1>Main Title</h1>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div).trim()).toBe('# Main Title');
    });

    test('converts h2 to markdown', () => {
      const div = document.createElement('div');
      div.innerHTML = '<h2>Subtitle</h2>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div).trim()).toBe('## Subtitle');
    });

    test('converts h3 to h6', () => {
      const div = document.createElement('div');
      div.innerHTML = '<h3>Level 3</h3><h4>Level 4</h4><h5>Level 5</h5><h6>Level 6</h6>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toContain('### Level 3');
      expect(result).toContain('#### Level 4');
      expect(result).toContain('##### Level 5');
      expect(result).toContain('###### Level 6');
    });

    test('converts headings with setext style', () => {
      const div = document.createElement('div');
      div.innerHTML = '<h1>Main Title</h1><h2>Subtitle</h2>';
      const converter = new HTMLToMarkdownConverter({ headingStyle: 'setext' });

      const result = converter.convert(div);
      expect(result).toContain('Main Title\n==========');
      expect(result).toContain('Subtitle\n--------');
    });
  });

  describe('text formatting', () => {
    test('converts strong/bold text', () => {
      const div = document.createElement('div');
      div.innerHTML = '<strong>Bold text</strong> and <b>also bold</b>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('**Bold text** and **also bold**');
    });

    test('converts emphasis/italic text', () => {
      const div = document.createElement('div');
      div.innerHTML = '<em>Italic text</em> and <i>also italic</i>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('*Italic text* and *also italic*');
    });

    test('respects emphasis delimiter options', () => {
      const div = document.createElement('div');
      div.innerHTML = '<em>Italic</em>';
      const converter = new HTMLToMarkdownConverter({ emphasisDelimiter: '_' });

      expect(converter.convert(div)).toBe('_Italic_');
    });

    test('respects strong delimiter options', () => {
      const div = document.createElement('div');
      div.innerHTML = '<strong>Bold</strong>';
      const converter = new HTMLToMarkdownConverter({ strongDelimiter: '__' });

      expect(converter.convert(div)).toBe('__Bold__');
    });

    test('converts small text', () => {
      const div = document.createElement('div');
      div.innerHTML = '<small>Small text</small>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('-# Small text');
    });
  });

  describe('paragraphs', () => {
    test('converts paragraphs', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('First paragraph\n\nSecond paragraph');
    });
  });

  describe('links', () => {
    test('converts inline links', () => {
      const div = document.createElement('div');
      div.innerHTML = '<a href="https://example.com">Link text</a>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('[Link text](https://example.com)');
    });

    test('converts links with titles', () => {
      const div = document.createElement('div');
      div.innerHTML = '<a href="https://example.com" title="Example site">Link text</a>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('[Link text](https://example.com "Example site")');
    });
  });

  describe('images', () => {
    test('converts images', () => {
      const div = document.createElement('div');
      div.innerHTML = '<img src="image.jpg" alt="Alt text">';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('![Alt text](image.jpg)');
    });

    test('converts images with titles', () => {
      const div = document.createElement('div');
      div.innerHTML = '<img src="image.jpg" alt="Alt text" title="Image title">';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('![Alt text](image.jpg "Image title")');
    });
  });

  describe('code', () => {
    test('converts inline code', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Some <code>inline code</code> here';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('Some `inline code` here');
    });

    test('converts code blocks with fenced style', () => {
      const div = document.createElement('div');
      div.innerHTML = '<pre><code>const x = 1;\nconsole.log(x);</code></pre>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('```\nconst x = 1;\nconsole.log(x);\n```');
    });

    test('converts code blocks with language', () => {
      const div = document.createElement('div');
      div.innerHTML = '<pre><code class="language-javascript">const x = 1;</code></pre>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });
  });

  describe('lists', () => {
    test('converts unordered lists', () => {
      const div = document.createElement('div');
      div.innerHTML = '<ul><li>First item</li><li>Second item</li></ul>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('- First item\n- Second item');
    });

    test('converts ordered lists', () => {
      const div = document.createElement('div');
      div.innerHTML = '<ol><li>First item</li><li>Second item</li></ol>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('1. First item\n2. Second item');
    });

    test('respects bullet list marker option', () => {
      const div = document.createElement('div');
      div.innerHTML = '<ul><li>Item</li></ul>';
      const converter = new HTMLToMarkdownConverter({ bulletListMarker: '*' });

      const result = converter.convert(div).trim();
      expect(result).toBe('* Item');
    });
  });

  describe('blockquotes', () => {
    test('converts blockquotes', () => {
      const div = document.createElement('div');
      div.innerHTML = '<blockquote>This is a quote</blockquote>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('> This is a quote');
    });

    test('converts multiline blockquotes', () => {
      const div = document.createElement('div');
      div.innerHTML = '<blockquote>Line 1<br>Line 2</blockquote>';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div).trim();
      expect(result).toBe('> Line 1\n> Line 2');
    });
  });

  describe('other elements', () => {
    test('converts line breaks', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Line 1<br>Line 2';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('Line 1\nLine 2');
    });

    test('converts horizontal rules', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Before<hr>After';
      const converter = new HTMLToMarkdownConverter();

      const result = converter.convert(div);
      expect(result).toContain('---');
    });

    test('handles generic containers like div and span', () => {
      const div = document.createElement('div');
      div.innerHTML = '<div>Content in div</div><span>Content in span</span>';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('Content in divContent in span');
    });
  });

  describe('markdown escaping', () => {
    test('escapes markdown special characters', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Text with * and _ and # characters';
      const converter = new HTMLToMarkdownConverter();

      expect(converter.convert(div)).toBe('Text with \\* and \\_ and \\# characters');
    });
  });

  describe('convenience functions', () => {
    test('htmlToMarkdown function works', () => {
      const div = document.createElement('div');
      div.innerHTML = '<h1>Title</h1>';

      expect(htmlToMarkdown(div).trim()).toBe('# Title');
    });
  });
});
