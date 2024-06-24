import { describe, expect, test, vi, beforeEach } from 'vitest';
import { HTMLParser, stripTags } from './html';

describe('stripTags', () => {
  test('should remove disallowed tags from the input', () => {
    const input = '<address>Hello <b>World</b>!</address>';
    expect(stripTags(input)).toBe('Hello <b>World</b>!');
  });

  test('should keep allowed tags in the input', () => {
    const input = '<div>Hello <b>World</b>!</div>';
    expect(stripTags(input, ['div', 'b'])).toBe(input);
  });

  test('should handle input without any tags', () => {
    const input = 'Hello World!';
    expect(stripTags(input)).toBe(input);
  });

  test('should handle empty input', () => {
    expect(stripTags('')).toBe('');
  });

  test('should remove comments from the input', () => {
    const input = '<!-- This is a comment --><div>Hello World!</div>';
    expect(stripTags(input)).toBe('<div>Hello World!</div>');
  });
});

describe('HTMLParser', () => {
  const handler = {
    onText: vi.fn(),
    onTagOpen: vi.fn(),
    onTagClose: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should call onTagOpen and onTagClose for each tag', () => {
    const parser = new HTMLParser(handler);
    parser.parse('<div>Hello <b>World</b>!</div>');
    expect(handler.onTagOpen).toHaveBeenCalledTimes(2);
    expect(handler.onTagClose).toHaveBeenCalledTimes(2);
  });

  test('should handle self-closing tags correctly', () => {
    const parser = new HTMLParser(handler);
    parser.parse('<br/>');
    expect(handler.onTagOpen).toHaveBeenCalledTimes(1);
    expect(handler.onTagClose).toHaveBeenCalledTimes(1);
  });

  test('should ignore comments', () => {
    const parser = new HTMLParser(handler);
    parser.parse('<!-- This is a comment --><div>Hello World!</div>');
    expect(handler.onTagOpen).toHaveBeenCalledTimes(1);
    expect(handler.onTagClose).toHaveBeenCalledTimes(1);
  });

  test('should handle empty input', () => {
    const parser = new HTMLParser(handler);
    parser.parse('');
    expect(handler.onTagOpen).not.toHaveBeenCalled();
    expect(handler.onTagClose).not.toHaveBeenCalled();
  });

  test('should handle input without any tags', () => {
    const parser = new HTMLParser(handler);
    parser.parse('Hello World!');
    expect(handler.onTagOpen).not.toHaveBeenCalled();
    expect(handler.onTagClose).not.toHaveBeenCalled();
  });
});
