import { describe, expect, test } from 'vitest';
import { hash, hash64 } from './hash';

describe('hash64', () => {
  test('returns correct hash for a given Uint8Array', () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    expect(hash64(arr)).toBe('71475e4315be0905');
  });

  test('returns different hashes for different inputs', () => {
    const arr1 = new Uint8Array([1, 2, 3, 4]);
    const arr2 = new Uint8Array([4, 3, 2, 1]);
    expect(hash64(arr1)).not.toBe(hash64(arr2));
  });

  test('returns same hash for same input with same seed', () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    const seed = 12345;
    expect(hash64(arr, seed)).toBe(hash64(arr, seed));
  });

  test('returns different hashes for same input with different seeds', () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    const seed1 = 12345;
    const seed2 = 54321;
    expect(hash64(arr, seed1)).not.toBe(hash64(arr, seed2));
  });

  test('handles empty Uint8Array', () => {
    const arr = new Uint8Array([]);
    expect(hash64(arr)).toBe('488bdcb81aee8d83');
  });

  test('handles large Uint8Array', () => {
    const arr = new Uint8Array(1000).fill(1);
    expect(hash64(arr)).toBe('da91dfe183a7f33f');
  });
});

describe('hash', () => {
  test('returns correct hash for a given Uint8Array', () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    expect(hash(arr)).toBe(2086439809);
  });

  test('returns different hashes for different inputs', () => {
    const arr1 = new Uint8Array([1, 2, 3, 4]);
    const arr2 = new Uint8Array([4, 3, 2, 1]);
    expect(hash(arr1)).not.toBe(hash(arr2));
  });

  test('returns same hash for same input', () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    expect(hash(arr)).toBe(hash(arr));
  });

  test('handles empty Uint8Array', () => {
    const arr = new Uint8Array([]);
    expect(hash(arr)).toBe(5381);
  });

  test('handles large Uint8Array', () => {
    const arr = new Uint8Array(1000).fill(1);
    expect(hash(arr)).toBe(3197454213);
  });

  test('returns correct hash for Uint8Array with negative values', () => {
    const arr = new Uint8Array([-1, -2, -3, -4]);
    expect(hash(arr)).toBe(2083712965);
  });

  test('returns correct hash for Uint8Array with maximum values', () => {
    const arr = new Uint8Array([255, 255, 255, 255]);
    expect(hash(arr)).toBe(2083728837);
  });
});
