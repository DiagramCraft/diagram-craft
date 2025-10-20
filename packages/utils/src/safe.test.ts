import { describe, expect, test } from 'vitest';
import { safeReMatch, safeSplit, safeTupleCast } from './safe';

describe('safeReMatch', () => {
  describe('basic regex matching', () => {
    test('should return matched groups when pattern matches', () => {
      const result = safeReMatch('hello world', /(\w+)\s(\w+)/, 3);
      expect(result).toEqual(['hello world', 'hello', 'world']);
    });

    test('should return undefined when pattern does not match', () => {
      const result = safeReMatch('hello', /(\d+)/, 1);
      expect(result).toBeUndefined();
    });

    test('should handle pattern with no capturing groups', () => {
      const result = safeReMatch('test', /test/, 1);
      expect(result).toEqual(['test']);
    });

    test('should handle pattern with multiple capturing groups', () => {
      const result = safeReMatch('2025-01-15', /(\d{4})-(\d{2})-(\d{2})/, 4);
      expect(result).toEqual(['2025-01-15', '2025', '01', '15']);
    });
  });

  describe('minimum length validation', () => {
    test('should assert minimum length requirement', () => {
      expect(() => safeReMatch('abc', /(a)(b)(c)/, 5)).toThrow();
    });

    test('should succeed when match length equals minimum', () => {
      const result = safeReMatch('abc', /(a)(b)(c)/, 4);
      expect(result).toEqual(['abc', 'a', 'b', 'c']);
    });

    test('should succeed when match length exceeds minimum', () => {
      const result = safeReMatch('abc', /(a)(b)(c)/, 3);
      expect(result).toEqual(['abc', 'a', 'b', 'c']);
    });
  });

  describe('maximum length validation', () => {
    test('should assert maximum length requirement', () => {
      expect(() => safeReMatch('abc', /(a)(b)(c)/, 1, 3)).toThrow();
    });

    test('should succeed when match length equals maximum', () => {
      const result = safeReMatch('abc', /(a)(b)(c)/, 1, 4);
      expect(result).toEqual(['abc', 'a', 'b', 'c']);
    });

    test('should succeed when match length is within range', () => {
      const result = safeReMatch('abc', /(a)(b)(c)/, 2, 5);
      expect(result).toEqual(['abc', 'a', 'b', 'c']);
    });

    test('should handle exact length requirement (min === max)', () => {
      const result = safeReMatch('abc', /(a)(b)(c)/, 4, 4);
      expect(result).toEqual(['abc', 'a', 'b', 'c']);
    });
  });

  describe('type safety', () => {
    test('should enforce minimum type parameter', () => {
      const result = safeReMatch('test', /(t)(e)(s)(t)/, 5);
      if (result) {
        expect(result.length).toBeGreaterThanOrEqual(5);
      }
    });

    test('should work with min=1', () => {
      const result = safeReMatch('a', /a/, 1);
      expect(result).toEqual(['a']);
    });

    test('should work with large minimum values', () => {
      const result = safeReMatch('abcdefghij', /(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)/, 11);
      expect(result?.length).toBe(11);
    });
  });
});

describe('safeSplit', () => {
  describe('basic splitting', () => {
    test('should split string by separator', () => {
      const result = safeSplit('a,b,c', ',', 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should split string with single element', () => {
      const result = safeSplit('hello', ',', 1);
      expect(result).toEqual(['hello']);
    });

    test('should handle empty strings in split result', () => {
      const result = safeSplit('a,,c', ',', 3);
      expect(result).toEqual(['a', '', 'c']);
    });

    test('should split by multi-character separator', () => {
      const result = safeSplit('a::b::c', '::', 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('minimum length validation', () => {
    test('should assert minimum length requirement', () => {
      expect(() => safeSplit('a,b', ',', 5)).toThrow();
    });

    test('should succeed when split length equals minimum', () => {
      const result = safeSplit('a,b,c', ',', 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should succeed when split length exceeds minimum', () => {
      const result = safeSplit('a,b,c,d', ',', 2);
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('maximum length validation', () => {
    test('should assert maximum length requirement', () => {
      expect(() => safeSplit('a,b,c,d', ',', 1, 3)).toThrow();
    });

    test('should succeed when split length equals maximum', () => {
      const result = safeSplit('a,b,c', ',', 1, 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should succeed when split length is within range', () => {
      const result = safeSplit('a,b,c', ',', 2, 5);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should handle exact length requirement (min === max)', () => {
      const result = safeSplit('a,b,c', ',', 3, 3);
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('common use cases', () => {
    test('should parse CSV line', () => {
      const result = safeSplit('name,age,city', ',', 3);
      expect(result).toEqual(['name', 'age', 'city']);
    });

    test('should parse path', () => {
      const result = safeSplit('path/to/file.txt', '/', 3);
      expect(result).toEqual(['path', 'to', 'file.txt']);
    });

    test('should parse key-value pair', () => {
      const result = safeSplit('key=value', '=', 2);
      expect(result).toEqual(['key', 'value']);
    });

    test('should handle URLs', () => {
      const result = safeSplit('https://example.com:8080/path', '://', 2);
      expect(result).toEqual(['https', 'example.com:8080/path']);
    });
  });

  describe('type safety', () => {
    test('should enforce minimum type parameter', () => {
      const result = safeSplit('a,b,c,d,e', ',', 5);
      expect(result.length).toBeGreaterThanOrEqual(5);
    });

    test('should work with min=1', () => {
      const result = safeSplit('test', ',', 1);
      expect(result).toEqual(['test']);
    });

    test('should work with large minimum values', () => {
      const result = safeSplit('1,2,3,4,5,6,7,8,9,10', ',', 10);
      expect(result.length).toBe(10);
    });
  });
});

describe('safeTupleCast', () => {
  describe('exact length casting', () => {
    test('should cast array with exact length', () => {
      const result = safeTupleCast([1, 2, 3], 3);
      expect(result).toEqual([1, 2, 3]);
    });

    test('should cast array of strings', () => {
      const result = safeTupleCast(['a', 'b'], 2);
      expect(result).toEqual(['a', 'b']);
    });

    test('should cast array of objects', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const result = safeTupleCast([obj1, obj2], 2);
      expect(result).toEqual([obj1, obj2]);
    });

    test('should cast single element array', () => {
      const result = safeTupleCast([42], 1);
      expect(result).toEqual([42]);
    });
  });

  describe('length validation', () => {
    test('should throw when array is shorter than required', () => {
      expect(() => safeTupleCast([1, 2], 3)).toThrow();
    });

    test('should throw when array is longer than required', () => {
      expect(() => safeTupleCast([1, 2, 3, 4], 3)).toThrow();
    });

    test('should throw for empty array when n > 0', () => {
      expect(() => safeTupleCast([], 1)).toThrow();
    });
  });

  describe('type preservation', () => {
    test('should preserve number types', () => {
      const result = safeTupleCast([1, 2, 3], 3);
      expect(typeof result[0]).toBe('number');
      expect(typeof result[1]).toBe('number');
      expect(typeof result[2]).toBe('number');
    });

    test('should preserve string types', () => {
      const result = safeTupleCast(['a', 'b'], 2);
      expect(typeof result[0]).toBe('string');
      expect(typeof result[1]).toBe('string');
    });

    test('should preserve boolean types', () => {
      const result = safeTupleCast([true, false], 2);
      expect(typeof result[0]).toBe('boolean');
      expect(typeof result[1]).toBe('boolean');
    });

    test('should preserve object references', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const result = safeTupleCast([obj1, obj2], 2);
      expect(result[0]).toBe(obj1);
      expect(result[1]).toBe(obj2);
    });

    test('should preserve mixed types', () => {
      const obj = { id: 1 };
      const result = safeTupleCast([1, 'test', obj], 3);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe('test');
      expect(result[2]).toBe(obj);
    });
  });

  describe('edge cases', () => {
    test('should handle null values', () => {
      const result = safeTupleCast([null, null], 2);
      expect(result).toEqual([null, null]);
    });

    test('should handle undefined values', () => {
      const result = safeTupleCast([undefined, undefined], 2);
      expect(result).toEqual([undefined, undefined]);
    });

    test('should handle mixed null and defined values', () => {
      const result = safeTupleCast([1, null, 'test', undefined], 4);
      expect(result).toEqual([1, null, 'test', undefined]);
    });

    test('should handle nested arrays', () => {
      const result = safeTupleCast(
        [
          [1, 2],
          [3, 4]
        ],
        2
      );
      expect(result).toEqual([
        [1, 2],
        [3, 4]
      ]);
    });

    test('should handle arrays with functions', () => {
      const fn1 = () => 1;
      const fn2 = () => 2;
      const result = safeTupleCast([fn1, fn2], 2);
      expect(result[0]).toBe(fn1);
      expect(result[1]).toBe(fn2);
    });
  });

  describe('common use cases', () => {
    test('should cast coordinate pair', () => {
      const result = safeTupleCast([10, 20], 2);
      expect(result).toEqual([10, 20]);
    });

    test('should cast RGB color', () => {
      const result = safeTupleCast([255, 128, 0], 3);
      expect(result).toEqual([255, 128, 0]);
    });

    test('should cast RGBA color', () => {
      const result = safeTupleCast([255, 128, 0, 0.5], 4);
      expect(result).toEqual([255, 128, 0, 0.5]);
    });

    test('should cast bounding box', () => {
      const result = safeTupleCast([0, 0, 100, 100], 4);
      expect(result).toEqual([0, 0, 100, 100]);
    });
  });

  describe('type safety', () => {
    test('should enforce exact length type parameter', () => {
      const result = safeTupleCast([1, 2, 3], 3);
      expect(result.length).toBe(3);
    });

    test('should work with n=1', () => {
      const result = safeTupleCast(['single'], 1);
      expect(result).toEqual(['single']);
    });

    test('should work with large tuple sizes', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = safeTupleCast(arr, 10);
      expect(result.length).toBe(10);
    });
  });
});
