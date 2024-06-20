import { describe, expect, test } from 'vitest';
import { urlToName } from './url';

describe('urlToName', () => {
  test('should return the file name from a valid URL', () => {
    expect(urlToName('http://example.com/path/to/file.txt')).toBe('file.txt');
  });

  test('should return the last path segment if the URL does not have a file extension', () => {
    expect(urlToName('http://example.com/path/to/directory')).toBe('directory');
  });

  test('should return the entire string if it is not a valid URL', () => {
    expect(urlToName('not a valid URL')).toBe('not a valid URL');
  });

  test('should return an empty string for a URL ending with a slash', () => {
    expect(urlToName('http://example.com/path/to/')).toBe('');
  });
});
