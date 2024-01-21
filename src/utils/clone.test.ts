import { describe, expect, test } from 'vitest';
import { deepClone } from './clone';

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
