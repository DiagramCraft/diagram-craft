// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { getAncestorWithClass, sanitizeHtml, setPosition } from './dom';

describe('setPosition', () => {
  it('should set the correct left and top styles on the element', () => {
    const element = document.createElement('div');
    const position = { x: 100, y: 200 };

    setPosition(element, position);

    expect(element.style.left).toBe('100px');
    expect(element.style.top).toBe('200px');
  });

  it('should handle zero coordinates correctly', () => {
    const element = document.createElement('div');
    const position = { x: 0, y: 0 };

    setPosition(element, position);

    expect(element.style.left).toBe('0px');
    expect(element.style.top).toBe('0px');
  });

  it('should handle negative coordinates correctly', () => {
    const element = document.createElement('div');
    const position = { x: -50, y: -75 };

    setPosition(element, position);

    expect(element.style.left).toBe('-50px');
    expect(element.style.top).toBe('-75px');
  });
});

describe('getAncestorWithClass', () => {
  it('should return the closest ancestor with the specified class', () => {
    const ancestor = document.createElement('div');
    ancestor.classList.add('target-class');
    const parent = document.createElement('div');
    const child = document.createElement('div');

    ancestor.appendChild(parent);
    parent.appendChild(child);

    expect(getAncestorWithClass(child, 'target-class')).toBe(ancestor);
  });

  it('should return undefined if no ancestor with the specified class exists', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');

    parent.appendChild(child);

    expect(getAncestorWithClass(child, 'nonexistent-class')).toBeUndefined();
  });

  it('should return the element itself if it has the specified class', () => {
    const element = document.createElement('div');
    element.classList.add('self-class');

    expect(getAncestorWithClass(element, 'self-class')).toBe(element);
  });

  it('should return undefined if the provided element is null', () => {
    expect(getAncestorWithClass(null as unknown as HTMLElement, 'target-class')).toBeUndefined();
  });

  it('should return undefined if the DOM tree is empty', () => {
    const isolatedElement = document.createElement('div');

    expect(getAncestorWithClass(isolatedElement, 'some-class')).toBeUndefined();
  });
});

describe('sanitizeHtml', () => {
  it('should remove script tags', () => {
    const input = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>Hello</p><p>World</p>');
  });

  it('should remove iframe tags', () => {
    const input = '<div>Content</div><iframe src="evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<div>Content</div>');
  });

  it('should remove object and embed tags', () => {
    const input = '<p>Text</p><object data="evil.swf"></object><embed src="evil.swf">';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>Text</p>');
  });

  it('should remove link and style tags', () => {
    const input = '<link rel="stylesheet" href="evil.css"><style>body { display: none; }</style><p>Content</p>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>Content</p>');
  });

  it('should remove form tags', () => {
    const input = '<div>Before</div><form action="evil.com"><input type="text"></form><div>After</div>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<div>Before</div><div>After</div>');
  });

  it('should remove event handler attributes', () => {
    const input = '<div onclick="alert(1)">Click</div><img onerror="alert(2)" src="x.jpg">';
    const result = sanitizeHtml(input);
    expect(result).toBe('<div>Click</div><img src="x.jpg">');
  });

  it('should remove javascript: URLs from href attributes', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a>Click</a>');
  });

  it('should remove javascript: URLs from src attributes', () => {
    const input = '<img src="javascript:alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).toBe('<img>');
  });

  it('should handle javascript: URLs with different casing', () => {
    const input = '<a href="JavaScript:alert(1)">Click</a><a href="JAVASCRIPT:alert(2)">Click2</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a>Click</a><a>Click2</a>');
  });

  it('should preserve safe HTML elements', () => {
    const input = '<div><p>Paragraph</p><span>Span</span><strong>Bold</strong><em>Italic</em></div>';
    const result = sanitizeHtml(input);
    expect(result).toBe(input);
  });

  it('should preserve safe attributes', () => {
    const input = '<div class="container" id="main"><a href="https://example.com">Link</a><img src="image.jpg" alt="Description"></div>';
    const result = sanitizeHtml(input);
    expect(result).toBe(input);
  });

  it('should handle empty strings', () => {
    const result = sanitizeHtml('');
    expect(result).toBe('');
  });

  it('should handle plain text without HTML', () => {
    const input = 'Just plain text';
    const result = sanitizeHtml(input);
    expect(result).toBe(input);
  });

  it('should handle multiple dangerous elements in complex HTML', () => {
    const input = `
      <div onclick="evil()">
        <p>Safe text</p>
        <script>alert("XSS")</script>
        <a href="javascript:void(0)">Bad link</a>
        <a href="https://safe.com">Good link</a>
        <iframe src="evil.com"></iframe>
      </div>
    `;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<iframe>');
    expect(result).toContain('<p>Safe text</p>');
    expect(result).toContain('https://safe.com');
  });

  it('should remove SVG tags with embedded scripts', () => {
    const input = '<p>Text</p><svg><script>alert("XSS")</script></svg>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>Text</p>');
  });

  it('should remove meta refresh tags', () => {
    const input = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)"><p>Content</p>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>Content</p>');
  });

  it('should remove data: URLs from href attributes', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a>Click</a>');
  });

  it('should remove data: URLs from src attributes', () => {
    const input = '<img src="data:image/svg+xml,<svg onload=alert(1)>">';
    const result = sanitizeHtml(input);
    expect(result).toBe('<img>');
  });

  it('should remove vbscript: URLs from href attributes', () => {
    const input = '<a href="vbscript:msgbox(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a>Click</a>');
  });

  it('should handle data: and vbscript: URLs with different casing', () => {
    const input = '<a href="DATA:text/html,alert">Link1</a><a href="VBScript:alert">Link2</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a>Link1</a><a>Link2</a>');
  });
});
