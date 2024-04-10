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
});
