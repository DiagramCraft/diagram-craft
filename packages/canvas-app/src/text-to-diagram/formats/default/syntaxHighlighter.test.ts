import { describe, expect, test } from 'vitest';
import { defaultSyntaxHighlighter } from './syntaxHighlighter';

describe('defaultSyntaxHighlighter', () => {
  test('highlights strings containing escaped quotes as a single string token', () => {
    const [line] = defaultSyntaxHighlighter.highlight(['node1: text "Hello \\"World\\""']);

    expect(line).toContain('<span class="syntax-string">"Hello \\"World\\""</span>');
  });

  test('escapes html before applying highlighting', () => {
    const [line] = defaultSyntaxHighlighter.highlight(['node1: text "<b>bold</b>"']);

    expect(line).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(line).not.toContain('<b>bold</b>');
  });
});
