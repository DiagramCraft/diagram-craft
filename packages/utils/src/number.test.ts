import { describe, expect, it } from 'vitest';
import { numberToString, parseNum } from './number';

describe('parseNum', () => {
  it('should return the parsed number when the string represents a valid number', () => {
    expect(parseNum('42')).toBe(42);
  });

  it('should return the default value when the string is undefined', () => {
    expect(parseNum(undefined, 10)).toBe(10);
  });

  it('should return the default value when the string is null', () => {
    expect(parseNum(null, 5)).toBe(5);
  });

  it('should return the default value when the string is invalid', () => {
    expect(parseNum('invalid', 0)).toBe(0);
  });

  it('should return the default value when the default value is negative and the string is invalid', () => {
    expect(parseNum('invalid', -10)).toBe(-10);
  });

  it('should return 0 when the string is empty and the default is not provided', () => {
    expect(parseNum('')).toBe(0);
  });

  it('should return 0 when the string is "NaN"', () => {
    expect(parseNum('NaN')).toBe(0);
  });

  it('should return the parsed number when the string represents 0', () => {
    expect(parseNum('0')).toBe(0);
  });
});

describe('numberToString', () => {
  it('should return the string representation of the number', () => {
    expect(numberToString(42)).toBe('42');
  });
});
