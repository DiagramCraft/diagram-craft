/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from 'vitest';
import { deepMerge } from './deepmerge.ts';

describe('deepmerge', () => {
  test('should merge objects', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 2, c: 3 };
    expect(deepMerge(a, b)).toEqual({ a: 2, b: 2, c: 3 });
  });

  test('should merge nested objects', () => {
    const a = { a: 1, b: { c: 2 } };
    const b = { a: 2, b: { d: 3 } };
    expect(deepMerge<any>(a, b)).toEqual({ a: 2, b: { c: 2, d: 3 } });
  });

  test('should not merge with object of different shape', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 3 };
    expect(deepMerge(a, b)).toEqual({ a: 3, b: 2 });
  });
});
