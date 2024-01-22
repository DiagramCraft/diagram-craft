import { common } from './object';
import { expect, describe, test } from 'vitest';

describe('common function', () => {
  test('should return an object with common properties', () => {
    const obj1 = { a: 1, b: 2, c: { d: 3 } };
    const obj2 = { a: 1, b: 3, c: { d: 3 } };
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({ a: 1, c: { d: 3 } });
  });

  test('should return an empty object if there are no common properties', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { c: 1, d: 2 };
    // @ts-ignore
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({});
  });

  test('should handle nested objects', () => {
    const obj1 = { a: { b: 1, c: 2 }, d: 3 };
    const obj2 = { a: { b: 1, e: 4 }, d: 4 };
    // @ts-ignore
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({ a: { b: 1 } });
  });

  test('should return an empty object if inputs are not objects', () => {
    const obj1 = 'not an object';
    const obj2 = { a: 1, b: 2 };
    // @ts-ignore
    const result = common(obj1, obj2);
    expect(result).to.deep.equal({});
  });
});
