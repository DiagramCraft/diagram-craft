import { newid } from './id.ts';
import { describe, test, expect } from 'vitest';

describe('newid', () => {
  test('returns a string of 7 characters', () => {
    const result = newid();
    expect(result.length).toBe(7);
  });

  test('returns a string containing only alphanumeric characters', () => {
    const result = newid();
    expect(result).toMatch(/^[0-9a-z]+$/);
  });

  test('returns a unique string each time it is called', () => {
    const results = new Array(100).fill(null).map(() => newid());
    const uniqueResults = [...new Set(results)];
    expect(results.length).toBe(uniqueResults.length);
  });
});
