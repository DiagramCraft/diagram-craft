import { describe, expect, test } from 'vitest';
import { clamp, isDifferent, isSame, round } from './math.ts';

describe('round', () => {
  test('rounds a number to 2 decimal places', () => {
    const result = round(1.2345);
    expect(result).toBe(1.23);
  });

  test('rounds a number up to 2 decimal places', () => {
    const result = round(1.236);
    expect(result).toBe(1.24);
  });

  test('rounds a negative number to 2 decimal places', () => {
    const result = round(-1.2345);
    expect(result).toBe(-1.23);
  });

  test('rounds a negative number up to 2 decimal places', () => {
    const result = round(-1.236);
    expect(result).toBe(-1.24);
  });

  test('returns 0 when the input is 0', () => {
    const result = round(0);
    expect(result).toBe(0);
  });

  test('returns 0 when the input is -0', () => {
    const result = round(-0);
    expect(result).toBe(0);
  });
});

describe('clamp', () => {
  test('returns the number when it is within the range', () => {
    const result = clamp(10, 5, 15);
    expect(result).toBe(10);
  });

  test('returns the lower limit when the number is below the range', () => {
    const result = clamp(3, 5, 15);
    expect(result).toBe(5);
  });

  test('returns the upper limit when the number is above the range', () => {
    const result = clamp(20, 5, 15);
    expect(result).toBe(15);
  });

  test('returns the lower limit when the number is equal to the lower limit', () => {
    const result = clamp(5, 5, 15);
    expect(result).toBe(5);
  });

  test('returns the upper limit when the number is equal to the upper limit', () => {
    const result = clamp(15, 5, 15);
    expect(result).toBe(15);
  });
});

describe('isSame', () => {
  test('returns true when numbers are approximately equal', () => {
    const result = isSame(10, 10.005);
    expect(result).toBe(true);
  });

  test('returns false when numbers are not approximately equal', () => {
    const result = isSame(10, 10.02);
    expect(result).toBe(false);
  });

  test('returns true when numbers are exactly equal', () => {
    const result = isSame(10, 10);
    expect(result).toBe(true);
  });
});

describe('isDifferent', () => {
  test('returns false when numbers are approximately equal', () => {
    const result = isDifferent(10, 10.005);
    expect(result).toBe(false);
  });

  test('returns true when numbers are not approximately equal', () => {
    const result = isDifferent(10, 10.02);
    expect(result).toBe(true);
  });

  test('returns false when numbers are exactly equal', () => {
    const result = isDifferent(10, 10);
    expect(result).toBe(false);
  });
});
