import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeRedirect } from './safeRedirect';

describe('sanitizeRedirect', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.com' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts relative paths with query and hash', () => {
    expect(sanitizeRedirect('/a/b?x=1#h')).toBe('/a/b?x=1#h');
    expect(sanitizeRedirect('/')).toBe('/');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'a/b', '/a\nb', '', undefined])(
    'rejects %s',
    value => {
      expect(sanitizeRedirect(value)).toBeUndefined();
    }
  );
});
