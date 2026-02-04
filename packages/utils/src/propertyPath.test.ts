import { DynamicAccessor } from './propertyPath';
import { test, expect, describe } from 'vitest';
import { UNSAFE } from './testUtils';

describe('DynamicAccessor', () => {
  test('get returns the correct value for a given path', () => {
    const accessor = new DynamicAccessor<{ a: { b: number } }>();
    const obj = { a: { b: 42 } };
    const result = accessor.get(obj, 'a.b');
    expect(result).toBe(42);
  });

  test('get returns undefined for a non-existent path', () => {
    const accessor = new DynamicAccessor<{ a: { b: number } }>();
    const obj = { a: { b: 42 } };

    const result = accessor.get(obj, 'a.c' as unknown as UNSAFE<'a.b'>);
    expect(result).toBeUndefined();
  });

  test('set correctly sets the value for a given path', () => {
    const accessor = new DynamicAccessor<{ a: { b: number } }>();
    const obj = { a: { b: 42 } };
    accessor.set(obj, 'a.b', 100);
    expect(obj.a.b).toBe(100);
  });

  test('set correctly creates and sets the value for a non-existent path', () => {
    const accessor = new DynamicAccessor<{ a: { b: number } }>();
    const obj = { a: { b: 42 } };

    accessor.set(obj, 'a.c' as unknown as UNSAFE<'a.b'>, 100);

    // @ts-ignore
    expect(obj.a.c).toBe(100);
  });

  describe('paths', () => {
    test('returns all paths for a nested object', () => {
      const accessor = new DynamicAccessor<{
        text: { size: number; bold: boolean };
        size: { width: number };
      }>();
      const obj = { text: { size: 13, bold: true }, size: { width: 17 } };
      const result = accessor.paths(obj);

      expect(result).toEqual(['size', 'text', 'size.width', 'text.bold', 'text.size']);
    });

    test('returns only top-level keys for flat object', () => {
      const accessor = new DynamicAccessor<{ a: number; b: string; c: boolean }>();
      const obj = { a: 1, b: 'test', c: true };
      const result = accessor.paths(obj);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('handles deeply nested objects', () => {
      const accessor = new DynamicAccessor<{
        a: { b: { c: { d: number } } };
      }>();
      const obj = { a: { b: { c: { d: 42 } } } };
      const result = accessor.paths(obj);

      expect(result).toEqual(['a', 'a.b', 'a.b.c', 'a.b.c.d']);
    });

    test('ignores null and undefined values', () => {
      const accessor = new DynamicAccessor<{
        a: number | null;
        b: { c: string | undefined };
      }>();
      const obj = { a: null, b: { c: undefined } };
      const result = accessor.paths(obj);

      expect(result).toEqual(['a', 'b', 'b.c']);
    });

    test('does not traverse arrays', () => {
      const accessor = new DynamicAccessor<{
        items: number[];
        data: { list: string[] };
      }>();
      const obj = { items: [1, 2, 3], data: { list: ['a', 'b'] } };
      const result = accessor.paths(obj);

      expect(result).toEqual(['data', 'items', 'data.list']);
    });

    test('does not traverse Date objects', () => {
      const accessor = new DynamicAccessor<{
        created: Date;
        meta: { updated: Date };
      }>();
      const obj = { created: new Date(), meta: { updated: new Date() } };
      const result = accessor.paths(obj);

      expect(result).toEqual(['created', 'meta', 'meta.updated']);
    });

    test('handles mixed depth levels', () => {
      const accessor = new DynamicAccessor<{
        a: number;
        b: { c: number; d: { e: number } };
        f: { g: { h: { i: number } } };
      }>();
      const obj = {
        a: 1,
        b: { c: 2, d: { e: 3 } },
        f: { g: { h: { i: 4 } } }
      };
      const result = accessor.paths(obj);

      expect(result).toEqual(['a', 'b', 'f', 'b.c', 'b.d', 'f.g', 'b.d.e', 'f.g.h', 'f.g.h.i']);
    });
  });
});
