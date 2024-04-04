import { common, deepMerge, deepClone, deepEquals } from './object';
import { expect, describe, test } from 'vitest';
import { UNSAFE } from './testUtils.ts';

describe('common function', () => {
  test('should return an object with common properties', () => {
    const obj1 = { a: 1, b: 2, c: { d: 3 } };
    const obj2 = { a: 1, b: 3, c: { d: 3 } };
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({ a: 1, c: { d: 3 } });
  });

  test('should return an empty object if there are no common properties', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { c: 1, d: 2 } as unknown as UNSAFE<typeof obj1>;
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({});
  });

  test('should handle nested objects', () => {
    const obj1 = { a: { b: 1, c: 2 }, d: 3 };
    const obj2 = { a: { b: 1, e: 4 }, d: 4 } as unknown as UNSAFE<typeof obj1>;
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({ a: { b: 1 } });
  });

  test('should return an empty object if inputs are not objects', () => {
    const obj2 = { a: 1, b: 2 };
    const obj1 = 'not an object' as unknown as UNSAFE<typeof obj2>;
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({});
  });
});

describe('deepmerge', () => {
  test('should merge objects', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 2, c: 3 };
    expect(deepMerge(a, b)).toEqual({ a: 2, b: 2, c: 3 });
  });

  test('should merge nested objects', () => {
    const a = { a: 1, b: { c: 2 } };
    const b = { a: 2, b: { d: 3 } } as unknown as UNSAFE<typeof a>;
    expect(deepMerge(a, b)).toEqual({ a: 2, b: { c: 2, d: 3 } });
  });

  test('should not merge with object of different shape', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 3 };
    expect(deepMerge(a, b)).toEqual({ a: 3, b: 2 });
  });
});

describe('deepClone function', () => {
  test('should return null when the target is null', () => {
    const result = deepClone(null);
    expect(result).to.equal(null);
  });

  test('should return a new date object with the same time when the target is a date object', () => {
    const date = new Date();
    const result = deepClone(date);
    expect(result).to.not.equal(date);
    expect(result.getTime()).to.equal(date.getTime());
  });

  test('should return a new array with the same elements when the target is an array', () => {
    const array = [1, 2, 3];
    const result = deepClone(array);
    expect(result).to.not.equal(array);
    expect(result).to.deep.equal(array);
  });

  test('should return a new object with the same properties when the target is an object', () => {
    const object = { a: 1, b: 2 };
    const result = deepClone(object);
    expect(result).to.not.equal(object);
    expect(result).to.deep.equal(object);
  });

  test('should handle nested objects and arrays', () => {
    const complex = { a: [1, 2, { b: 3 }] };
    const result = deepClone(complex);
    expect(result).to.not.equal(complex);
    expect(result.a).to.not.equal(complex.a);
    expect(result.a[2]).to.not.equal(complex.a[2]);
    expect(result).to.deep.equal(complex);
  });
});

describe('deepEquals function', () => {
  test('should return true for identical primitive values', () => {
    expect(deepEquals(1, 1)).toBe(true);
    expect(deepEquals('a', 'a')).toBe(true);
    expect(deepEquals(true, true)).toBe(true);
  });

  test('should return false for different primitive values', () => {
    expect(deepEquals(1, 2)).toBe(false);
    expect(deepEquals('a', 'b')).toBe(false);
    expect(deepEquals(true, false)).toBe(false);
  });

  test('should return true for identical objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    expect(deepEquals(obj1, obj2)).toBe(true);
  });

  test('should return false for different objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 2, b: 2 };
    expect(deepEquals(obj1, obj2)).toBe(false);
  });

  test('should return true for identical arrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    expect(deepEquals(arr1, arr2)).toBe(true);
  });

  test('should return false for different arrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 4];
    expect(deepEquals(arr1, arr2)).toBe(false);
  });

  test('should return true for identical nested structures', () => {
    const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
    const obj2 = { a: 1, b: { c: 2, d: [3, 4] } };
    expect(deepEquals(obj1, obj2)).toBe(true);
  });

  test('should return false for different nested structures', () => {
    const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
    const obj2 = { a: 1, b: { c: 2, d: [3, 5] } };
    expect(deepEquals(obj1, obj2)).toBe(false);
  });
});
