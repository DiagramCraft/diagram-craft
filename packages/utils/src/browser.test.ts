import { afterEach, describe, expect, test, vi } from 'vitest';
import { Browser } from './browser';

describe('Browser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isChrome', () => {
    test('returns true when userAgentData contains Chromium brand', () => {
      vi.stubGlobal('navigator', {
        userAgentData: {
          brands: [{ brand: 'Chromium', version: '120' }]
        }
      });

      expect(Browser.isChrome()).toBe(true);
    });

    test('returns false when userAgentData does not contain Chromium brand', () => {
      vi.stubGlobal('navigator', {
        userAgentData: {
          brands: [{ brand: 'Safari', version: '17' }]
        }
      });

      expect(Browser.isChrome()).toBe(false);
    });

    test('returns false when userAgentData is not available', () => {
      vi.stubGlobal('navigator', {
        userAgentData: undefined
      });

      expect(Browser.isChrome()).toBe(false);
    });
  });

  describe('isSafari', () => {
    test('returns true when userAgent contains Safari', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      });

      expect(Browser.isSafari()).toBe(true);
    });

    test('returns false when userAgent does not contain Safari', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0'
      });

      expect(Browser.isSafari()).toBe(false);
    });
  });

  describe('isFirefox', () => {
    test('returns true when userAgent contains Firefox', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
      });

      expect(Browser.isFirefox()).toBe(true);
    });

    test('returns false when userAgent does not contain Firefox', () => {
      vi.stubGlobal('navigator', {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      });

      expect(Browser.isFirefox()).toBe(false);
    });
  });
});
